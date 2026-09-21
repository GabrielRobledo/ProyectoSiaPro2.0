import os
import sys
import pandas as pd
import pymysql
import json

# CONEXIÓN CON MYSQL
db = pymysql.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER', 'root'),
    passwd=os.getenv('DB_PASSWORD', ''),
    db=os.getenv('DB_NAME', 'db_siap'),
    port=int(os.getenv('DB_PORT', 3306)),
    ssl={
        'ssl': os.getenv('DB_SSL', 'false').lower() == 'true',
    },
)
cursor = db.cursor()
print('CONEXIÓN EXITOSA')

if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    file_path = 'BasePami.xlsx'

print(f"Procesando archivo mensual: {file_path}")

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1')
    dfNomen = pd.read_excel(file_path, sheet_name='Hoja3', header=0)
    print(f"Filas de atenciones en Hoja1: {len(df)}")
    print(f"Filas de nomencladores en Hoja3: {len(dfNomen)}")
except Exception as e:
    print(f"Error al leer las hojas del Excel: {e}")
    sys.exit(1)

# 1. VERIFICAR / CREAR TABLAS PRINCIPALES (con la columna descripcion en TEXT para evitar desbordamientos)
cursor.execute("""CREATE TABLE IF NOT EXISTS modulos(
                    idModulo int primary key,
                    descripcion text not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS beneficiarios(
                    idBeneficiario int AUTO_INCREMENT primary key,
                    apeYnom varchar(100) not null,
                    NroBeneficiario varchar(50) not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS efectores(
                    idEfector int AUTO_INCREMENT primary key,
                    codPrestador varchar(10) not null,
                    RazonSocial varchar(100) not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS nomencladores(
                    idNomenclador int auto_increment primary key,
                    codPractica int not null,
                    descripcion text not null,
                    valorGeneral double(20,2) not null,
                    idModulo int not null,
                    FOREIGN KEY(idModulo) REFERENCES modulos(idModulo));""")

cursor.execute("""CREATE TABLE IF NOT EXISTS atenciones(
                    idAtencion int auto_increment primary key,
                    tipoAtencion varchar(50) not null,
                    fecha varchar(50) not null,
                    idBeneficiario int not null,
                    idNomenclador int not null,
                    fechaPractica varchar(50),
                    cantidad int,
                    valorTotal double(20,2),
                    idEfector int not null,
                    FOREIGN KEY(idBeneficiario) REFERENCES beneficiarios(idBeneficiario),
                    FOREIGN KEY(idNomenclador) REFERENCES nomencladores(idNomenclador),
                    FOREIGN KEY(idEfector) REFERENCES efectores(idEfector));""")

db.commit()
print("Tablas verificadas/creadas correctamente.")

# 2. SINCRONIZAR MÓDULOS EN LOTE
cursor.execute("SELECT idModulo FROM modulos")
modulos_existentes = {row[0] for row in cursor.fetchall()}

modulos_ids = set()
for _, row in df.dropna(subset=["MODULO"]).iterrows():
    try: modulos_ids.add(int(row["MODULO"]))
    except: pass
for _, row in dfNomen.dropna(subset=["modulo"]).iterrows():
    try: modulos_ids.add(int(row["modulo"]))
    except: pass

nuevos_modulos = []
for mod_id in modulos_ids:
    if mod_id not in modulos_existentes:
        match_desc = df[df["MODULO"] == mod_id]["NOMBRE_MODULO"]
        desc_mod = str(match_desc.values[0]) if not match_desc.empty else f"Módulo {mod_id}"
        nuevos_modulos.append((mod_id, desc_mod))

if nuevos_modulos:
    cursor.executemany("INSERT INTO modulos (idModulo, descripcion) VALUES (%s, %s)", nuevos_modulos)
    db.commit()
print(f"Módulos nuevos sincronizados: {len(nuevos_modulos)}")

# 3. PROCESAR NOMENCLADORES EN LOTE
cursor.execute("SELECT codPractica, idModulo, idNomenclador FROM nomencladores")
nomencladores_db = {(row[0], row[1]): row[2] for row in cursor.fetchall()}

a_insertar_nom = []
a_actualizar_nom = []

for _, row in dfNomen.iterrows():
    try:
        cod_prac = int(row.get("codPractica"))
        mod_id = int(row.get("modulo"))
    except:
        continue

    descripcion = str(row.get("DescripcionPractica", "Sin descripción")).replace('"', '')
    raw_val = row.get("Valor GENERAL", 0.0)
    valor_gen = float(raw_val) if not pd.isna(raw_val) else 0.0

    key = (cod_prac, mod_id)
    if key not in nomencladores_db:
        a_insertar_nom.append((cod_prac, descripcion, valor_gen, mod_id))
    else:
        id_nom = nomencladores_db[key]
        a_actualizar_nom.append((valor_gen, descripcion, id_nom))

if a_insertar_nom:
    cursor.executemany("""INSERT INTO nomencladores (codPractica, descripcion, valorGeneral, idModulo) 
                          VALUES (%s, %s, %s, %s)""", a_insertar_nom)
if a_actualizar_nom:
    cursor.executemany("""UPDATE nomencladores SET valorGeneral = %s, descripcion = %s 
                          WHERE idNomenclador = %s""", a_actualizar_nom)
db.commit()
print(f"Nomencladores insertados: {len(a_insertar_nom)}, actualizados: {len(a_actualizar_nom)}")

# 4. PROCESAR BENEFICIARIOS EN LOTE
cursor.execute("SELECT NroBeneficiario FROM beneficiarios")
beneficiarios_db = {row[0] for row in cursor.fetchall()}

nuevos_beneficiarios = []
for _, row in df.iterrows():
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except:
        continue
    
    if nrobene not in beneficiarios_db:
        beneficiarios_db.add(nrobene) # Evitar duplicados dentro del mismo excel
        nuevos_beneficiarios.append((str(row["APELLIDO_Y_NOMBRE"]), nrobene))

if nuevos_beneficiarios:
    cursor.executemany("INSERT INTO beneficiarios (apeYnom, NroBeneficiario) VALUES (%s, %s)", nuevos_beneficiarios)
    db.commit()
print(f"Beneficiarios nuevos agregados: {len(nuevos_beneficiarios)}")

# 5. PROCESAR EFECTORES EN LOTE
cursor.execute("SELECT codPrestador FROM efectores")
efectores_db = {row[0] for row in cursor.fetchall()}

nuevos_efectores = []
for _, row in df.iterrows():
    cod_pres = row.get("cod")
    if pd.isna(cod_pres): continue
    cod_str = str(cod_pres)
    
    if cod_str not in efectores_db:
        efectores_db.add(cod_str)
        nuevos_efectores.append((cod_str, str(row.get("Efector", "Sin nombre"))))

if nuevos_efectores:
    cursor.executemany("INSERT INTO efectores (codPrestador, RazonSocial) VALUES (%s, %s)", nuevos_efectores)
    db.commit()
print(f"Efectores nuevos agregados: {len(nuevos_efectores)}")

# RECARGAR DICCIONARIOS DE MAPEO PARA LAS ATENCIONES
cursor.execute("SELECT NroBeneficiario, idBeneficiario FROM beneficiarios")
map_beneficiarios = {row[0]: row[1] for row in cursor.fetchall()}

cursor.execute("SELECT codPractica, idModulo, idNomenclador FROM nomencladores")
map_nomencladores = {(row[0], row[1]): row[2] for row in cursor.fetchall()}

cursor.execute("SELECT codPrestador, idEfector FROM efectores")
map_efectores = {str(row[0]): row[1] for row in cursor.fetchall()}

# 6. INSERTAR ATENCIONES EN LOTE
print("Preparando e insertando Atenciones del período...")
atenciones_a_insertar = []

for _, row in df.iterrows():
    if row.get("D_PRESTACION") != "PRACTICA MEDICA":
        continue
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except:
        continue

    idBen = map_beneficiarios.get(nrobene)
    if not idBen: continue

    # Nota: si necesitás el idModulo para buscar el nomenclador, asegurate de tenerlo mapeado, 
    # aquí buscamos por codPractica o usando el módulo correspondiente de la fila
    try:
        mod_id = int(row["MODULO"])
        cod_prac = int(row["PRACTICA"])
        idNom = map_nomencladores.get((cod_prac, mod_id))
    except:
        idNom = None
    if not idNom: continue

    idEfec = map_efectores.get(str(row.get("cod")))
    if not idEfec: continue

    raw_valor_total = row.get("Valor Total", 0)
    valor_total = float(raw_valor_total) if not pd.isna(raw_valor_total) else 0.0

    raw_cant = row.get("CANT.", 1)
    cantidad = int(raw_cant) if not pd.isna(raw_cant) else 1

    tipo_atn = str(row.get("tipoatencion", ""))
    fecha_gral = str(row.get("FECHA_DE_PRESTACION", ""))
    fecha_prac = str(row.get("F_PRACTICA", ""))

    atenciones_a_insertar.append((tipo_atn, fecha_gral, idBen, idNom, fecha_prac, cantidad, valor_total, idEfec))

# Insertar masivamente en bloques usando executemany
if atenciones_a_insertar:
    cursor.executemany("""INSERT INTO atenciones 
                          (tipoAtencion, fecha, idBeneficiario, idNomenclador, fechaPractica, cantidad, valorTotal, idEfector) 
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""", atenciones_a_insertar)
    db.commit()

resumen = {
    "status": "success",
    "mensaje": "¡Proceso mensual cargado con éxito!",
    "filasHoja1": len(df),
    "modulosNuevos": len(nuevos_modulos),
    "nomencladoresInsertados": len(a_insertar_nom),
    "nomencladoresActualizados": len(a_actualizar_nom),
    "beneficiariosNuevos": len(nuevos_beneficiarios),
    "efectoresNuevos": len(nuevos_efectores),
    "atencionesInsertadas": len(atenciones_a_insertar),
}

# Imprimimos en formato JSON al final para que Node.js lo pueda leer fácilmente
print(json.dumps(resumen))