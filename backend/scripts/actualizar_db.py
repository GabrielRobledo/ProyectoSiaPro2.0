import os
import sys
import pandas as pd
import pymysql

# CONEXIÓN CON MYSQL (Leyendo directamente del entorno del sistema que le pasa Node)
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

# OBTENER RUTA DEL EXCEL
if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    file_path = 'BasePami.xlsx'

print(f"Procesando archivo mensual: {file_path}")

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1')
    # Hoja3 con los nomencladores y montos del período actual 
    dfNomen = pd.read_excel(file_path, sheet_name='Hoja3', header=0)
    
    print(f"Filas de atenciones en Hoja1: {len(df)}")
    print(f"Filas de nomencladores en Hoja3: {len(dfNomen)}")
except Exception as e:
    print(f"Error al leer las hojas del Excel: {e}")
    sys.exit(1)

# 1. VERIFICAR / CREAR TABLAS PRINCIPALES
cursor.execute("""CREATE TABLE IF NOT EXISTS Modulos(
                    idModulo int primary key,
                    descripcion varchar(100) not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS Beneficiarios(
                    idBeneficiario int AUTO_INCREMENT primary key,
                    apeYnom varchar(100) not null,
                    NroBeneficiario varchar(50) not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS Efectores(
                    idEfector int AUTO_INCREMENT primary key,
                    codPrestador varchar(10) not null,
                    RazonSocial varchar(100) not null);""")

cursor.execute("""CREATE TABLE IF NOT EXISTS Nomencladores(
                    idNomenclador int auto_increment primary key,
                    codPractica int not null,
                    descripcion varchar(100) not null,
                    valorGeneral double(20,2) not null,
                    idModulo int not null,
                    FOREIGN KEY(idModulo) REFERENCES Modulos(idModulo));""")

cursor.execute("""CREATE TABLE IF NOT EXISTS Atenciones(
                    idAtencion int auto_increment primary key,
                    tipoAtencion varchar(50) not null,
                    fecha varchar(50) not null,
                    idBeneficiario int not null,
                    idNomenclador int not null,
                    fechaPractica varchar(50),
                    cantidad int,
                    valorTotal double(20,2),
                    idEfector int not null,
                    FOREIGN KEY(idBeneficiario) REFERENCES Beneficiarios(idBeneficiario),
                    FOREIGN KEY(idNomenclador) REFERENCES Nomencladores(idNomenclador),
                    FOREIGN KEY(idEfector) REFERENCES Efectores(idEfector));""")
print("Tablas verificadas/creadas correctamente.")

# 2. PROCESAR MÓDULOS (Desde la Hoja 1 y Hoja 3)
print("Sincronizando Módulos...")
mod_count = 0
# Extraemos módulos únicos de ambas hojas para asegurar cobertura total
modulos_ids = set()
for _, row in df.dropna(subset=["MODULO"]).iterrows():
    try: modulos_ids.add(int(row["MODULO"]))
    except: pass
for _, row in dfNomen.dropna(subset=["modulo"]).iterrows():
    try: modulos_ids.add(int(row["modulo"]))
    except: pass

for mod_id in modulos_ids:
    cursor.execute("SELECT idModulo FROM Modulos WHERE idModulo = %s", (mod_id,))
    if cursor.fetchone() is None:
        # Buscamos la descripción en el df
        match_desc = df[df["MODULO"] == mod_id]["NOMBRE_MODULO"]
        desc_mod = str(match_desc.values[0]) if not match_desc.empty else f"Módulo {mod_id}"
        cursor.execute("INSERT INTO Modulos (idModulo, descripcion) VALUES (%s, %s)", (mod_id, desc_mod))
        mod_count += 1
db.commit()
print(f"Módulos nuevos sincronizados: {mod_count}")

# 3. PROCESAR NOMENCLADORES DEL PERÍODO (Hoja 3 PRIMERO)
print("Actualizando/Insertando Nomencladores del período...")
nom_count = 0
for index, row in dfNomen.iterrows():
    cod_prac_val = row.get("codPractica")
    if pd.isna(cod_prac_val): continue
    try: cod_prac = int(cod_prac_val)
    except: continue

    mod_val = row.get("modulo")
    if pd.isna(mod_val): continue
    try: mod_id = int(mod_val)
    except: continue

    descripcion = str(row.get("DescripcionPractica", "Sin descripción")).replace('"', '')
    raw_val = row.get("Valor GENERAL", 0.0)
    valor_gen = float(raw_val) if not pd.isna(raw_val) else 0.0

    # Verificamos si la práctica ya existe para actualizar su valor o insertarla si es nueva
    cursor.execute("SELECT idNomenclador, valorGeneral FROM Nomencladores WHERE codPractica = %s AND idModulo = %s", (cod_prac, mod_id))
    res_nom = cursor.fetchone()
    
    if res_nom is None:
        # Insertamos si no existe
        cursor.execute("""INSERT INTO Nomencladores (codPractica, descripcion, valorGeneral, idModulo) 
                          VALUES (%s, %s, %s, %s)""", 
                       (cod_prac, descripcion, valor_gen, mod_id))
        nom_count += 1
    else:
        # Si ya existe, actualizamos su valor por si cambió en este nuevo período
        cursor.execute("UPDATE Nomencladores SET valorGeneral = %s, descripcion = %s WHERE idNomenclador = %s", 
                       (valor_gen, descripcion, res_nom[0]))
db.commit()
print(f"Nomencladores procesados (Nuevos/Actualizados): {nom_count}")

# 4. PROCESAR BENEFICIARIOS (Acumulativos)
print("Procesando Beneficiarios...")
ben_count = 0
for index, row in df.iterrows():
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except:
        continue
        
    cursor.execute("SELECT idBeneficiario FROM Beneficiarios WHERE NroBeneficiario = %s", (nrobene,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO Beneficiarios (apeYnom, NroBeneficiario) VALUES (%s, %s)", 
                       (str(row["APELLIDO_Y_NOMBRE"]), nrobene))
        ben_count += 1
db.commit()
print(f"Beneficiarios nuevos agregados: {ben_count}")

# 5. PROCESAR EFECTORES (Acumulativos)
print("Procesando Efectores...")
efe_count = 0
for index, row in df.iterrows():
    cod_pres = row.get("cod")
    if pd.isna(cod_pres): continue
    
    cursor.execute("SELECT idEfector FROM Efectores WHERE codPrestador = %s", (str(cod_pres),))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO Efectores (codPrestador, RazonSocial) VALUES (%s, %s)", 
                       (str(cod_pres), str(row.get("Efector", "Sin nombre"))))
        efe_count += 1
db.commit()
print(f"Efectores nuevos agregados: {efe_count}")

# 6. INSERTO ATENCIONES (Evitando duplicados si se corre el mismo período)
print("Insertando Atenciones del período...")
atn_count = 0
for index, row in df.iterrows():
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except:
        continue

    cursor.execute("SELECT idBeneficiario FROM Beneficiarios WHERE NroBeneficiario = %s", (nrobene,))
    res_ben = cursor.fetchone()
    if not res_ben: continue
    idBen = res_ben[0]

    cursor.execute("SELECT idNomenclador FROM Nomencladores WHERE codPractica = %s", (row.get("PRACTICA"),))
    res_nom = cursor.fetchone()
    if not res_nom: continue
    idNom = res_nom[0]

    cursor.execute("SELECT idEfector FROM Efectores WHERE codPrestador = %s", (str(row.get("cod")),))
    res_efe = cursor.fetchone()
    if not res_efe: continue
    idEfec = res_efe[0]

    raw_valor_total = row.get("Valor Total", 0)
    valor_total = float(raw_valor_total) if not pd.isna(raw_valor_total) else 0.0

    raw_cant = row.get("CANT.", 1)
    cantidad = int(raw_cant) if not pd.isna(raw_cant) else 1

    tipo_atn = str(row.get("tipoatencion", ""))
    fecha_gral = str(row.get("FECHA_DE_PRESTACION", ""))
    fecha_prac = str(row.get("F_PRACTICA", ""))

    if row.get("D_PRESTACION") == "PRACTICA MEDICA":
        # VERIFICAR SI YA EXISTE LA ATENCIÓN PARA EVITAR DUPLICADOS
        cursor.execute("""SELECT idAtencion FROM Atenciones 
                          WHERE idBeneficiario = %s AND idNomenclador = %s AND idEfector = %s AND fechaPractica = %s""",
                       (idBen, idNom, idEfec, fecha_prac))
        
        if cursor.fetchone() is None:
            # Si no existe, la insertamos
            cursor.execute("""INSERT INTO Atenciones 
                              (tipoAtencion, fecha, idBeneficiario, idNomenclador, fechaPractica, cantidad, valorTotal, idEfector) 
                              VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                           (tipo_atn, fecha_gral, idBen, idNom, fecha_prac, cantidad, valor_total, idEfec))
            atn_count += 1

db.commit()
print(f"Atenciones nuevas insertadas (sin duplicados): {atn_count}")

print('¡PROCESO MENSUAL CARGADO CON ÉXITO!')