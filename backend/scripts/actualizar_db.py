import os
import sys
import pandas as pd
import pymysql
import json
import hashlib


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

def calcular_sha256(ruta_archivo: str) -> str:
    h = hashlib.sha256()
    with open(ruta_archivo, "rb") as f:
        for bloque in iter(lambda: f.read(65536), b""):
            h.update(bloque)
    return h.hexdigest()


def buscar_importacion_por_hash(hash_hex: str):
    cursor.execute(
        """
        SELECT idHistorial, periodo, fechaCarga, filasHoja1, atencionesInsertadas, estado
        FROM historial_importaciones
        WHERE hashArchivo = %s AND estado = 'Completado'
        ORDER BY idHistorial DESC
        LIMIT 1
        """,
        (hash_hex,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    return {
        "idHistorial": row[0],
        "periodo": row[1],
        "fechaCarga": str(row[2]),
        "filasHoja1": row[3],
        "atencionesInsertadas": row[4],
        "estado": row[5],
    }

print('CONEXIÓN EXITOSA')

if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    file_path = 'BasePami.xlsx'

print(f"Procesando archivo mensual: {file_path}")

check_only = "--check-only" in sys.argv
args_limpios = [a for a in sys.argv[1:] if a != "--check-only"]
file_path = args_limpios[0] if args_limpios else "BasePami.xlsx"

if not os.path.exists(file_path):
    print(json.dumps({"status": "error", "mensaje": f"No se encontró el archivo: {file_path}"}))
    sys.exit(1)

posible_hash = args_limpios[1] if len(args_limpios) > 1 else ""
if len(posible_hash) == 64 and all(c in "0123456789abcdefABCDEF" for c in posible_hash):
    hash_archivo = posible_hash.lower()
else:
    hash_archivo = calcular_sha256(file_path)

previo = buscar_importacion_por_hash(hash_archivo)

if check_only:
    if previo:
        print(json.dumps({
            "status": "duplicate",
            "alreadyImported": True,
            "hashArchivo": hash_archivo,
            "registroPrevio": previo,
            "mensaje": f"El archivo ya fue importado para el período {previo['periodo']}."
        }))
    else:
        print(json.dumps({
            "status": "ok",
            "alreadyImported": False,
            "hashArchivo": hash_archivo
        }))
    sys.exit(0)

# Si no es --check-only y ya existe, frenamos antes de leer Excel ni insertar
if previo:
    print(json.dumps({
        "status": "duplicate",
        "alreadyImported": True,
        "hashArchivo": hash_archivo,
        "registroPrevio": previo,
        "mensaje": f"El archivo ya fue importado (período {previo['periodo']}, carga #{previo['idHistorial']})."
    }))
    sys.exit(0)

    COLUMNAS_HOJA1_REQUERIDAS = [
    "NRO_PRESTACION",
    "tipoatencion",
    "FECHA_DE_PRESTACION",
    "NRO_BENEFICIO",
    "GRADO_PARENTESCO",
    "APELLIDO_Y_NOMBRE",
    "MODALIDAD_PRESTACION",
    "NRO_ORDEN_DE_PRESTACION",
    "MATRICULA",
    "MODULO",
    "NOMBRE_MODULO",
    "PRACTICA",
    "D_PRACTICA",
    "F_PRACTICA",
    "CANT.",
    "D_PRESTACION",
    "MODALIDAD_PRESTACION.1",
    "NRO_ORDEN_PRESTACION_PRACTICA",
    "BOCA_ATENCION",
    "Valor\n Unitario",
    "Valor Total",
    "BA\nExterna",
    "Efector",
    "CONVENIO",
    "OBSERVACIONES",
    "para banco de sangre y laboratorio",
    "cod",
    "Cant.\nDébito",
    "Debito",
]

COLUMNAS_HOJA3_REQUERIDAS = [
    "modulo",
    "codPractica",
    "DescripcionPractica",
    "Valor GENERAL",
]

try:
    excel_file = pd.ExcelFile(file_path)
    hojas_faltantes = [h for h in ["Hoja1", "Hoja3"] if h not in excel_file.sheet_names]
    if hojas_faltantes:
        print(json.dumps({
            "status": "invalid_format",
            "errorType": "FORMAT_MISMATCH",
            "mensaje": f"El formato del archivo no coincide. Faltan las hojas: {', '.join(hojas_faltantes)}.",
            "hojasFaltantes": hojas_faltantes,
            "columnasFaltantesHoja1": [],
            "columnasFaltantesHoja3": [],
        }))
        sys.exit(1)

    df = pd.read_excel(excel_file, sheet_name="Hoja1")
    dfNomen = pd.read_excel(excel_file, sheet_name="Hoja3", header=0)

    faltantes_h1 = [c for c in COLUMNAS_HOJA1_REQUERIDAS if c not in df.columns]
    faltantes_h3 = [c for c in COLUMNAS_HOJA3_REQUERIDAS if c not in dfNomen.columns]

    if faltantes_h1 or faltantes_h3:
        print(json.dumps({
            "status": "invalid_format",
            "errorType": "FORMAT_MISMATCH",
            "mensaje": "El formato del archivo no coincide con la estructura esperada.",
            "hojasFaltantes": [],
            "columnasFaltantesHoja1": [c.replace("\n", " ").strip() for c in faltantes_h1],
            "columnasFaltantesHoja3": [c.replace("\n", " ").strip() for c in faltantes_h3],
        }))
        sys.exit(1)

    print(f"Filas de atenciones en Hoja1: {len(df)}")
    print(f"Filas de nomencladores en Hoja3: {len(dfNomen)}")
except Exception as e:
    print(json.dumps({
        "status": "invalid_format",
        "errorType": "FORMAT_MISMATCH",
        "mensaje": f"El formato del archivo no coincide o no pudo leerse correctamente: {e}",
        "hojasFaltantes": [],
        "columnasFaltantesHoja1": [],
        "columnasFaltantesHoja3": [],
    }))
    sys.exit(1)

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1')
    dfNomen = pd.read_excel(file_path, sheet_name='Hoja3', header=0)
    print(f"Filas de atenciones en Hoja1: {len(df)}")
    print(f"Filas de nomencladores en Hoja3: {len(dfNomen)}")
except Exception as e:
    print(f"Error al leer las hojas del Excel: {e}")
    sys.exit(1)

# =========================================================================
# EXTRACCIÓN Y FORMATEO DEL PERIODO (aaaa-mm) DESDE FECHA_DE_PRESTACION
# =========================================================================
periodo_formateado = "Desconocido"
try:
    if "FECHA_DE_PRESTACION" in df.columns and not df.empty:
        # Tomamos el primer valor no nulo de la columna FECHA_DE_PRESTACION
        primera_fecha_str = df["FECHA_DE_PRESTACION"].dropna().iloc[0]
        
        # Convertimos el string (ej: '10-aug-24') a fecha usando pandas
        # format='%d-%b-%y' interpreta perfectamente el día, el mes abreviado en inglés y el año de 2 dígitos
        fecha_dt = pd.to_datetime(primera_fecha_str, format='%d-%b-%y')
        
        # Lo formateamos como año-mes ('aaaa-mm', ej: '2024-08')
        periodo_formateado = fecha_dt.strftime('%Y-%m')
except Exception as e:
    print(f"Aviso: No se pudo extraer automáticamente el periodo de la fecha: {e}")
    # Fallback por si la fecha viene en otro formato o está vacía
    periodo_formateado = "2026-08" 

print(f"Periodo detectado para el histórico: {periodo_formateado}")    

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

# 6. INSERTAR ATENCIONES EN LOTE (Usando INSERT IGNORE para frenar duplicados)
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

# CONTADOR REAL DE FILAS INSERTADAS EFECTIVAMENTE
atenciones_realmente_insertadas = 0

if atenciones_a_insertar:
    # Usamos INSERT IGNORE para que la BD rechace las repetidas
    cursor.executemany("""INSERT IGNORE INTO atenciones 
                          (tipoAtencion, fecha, idBeneficiario, idNomenclador, fechaPractica, cantidad, valorTotal, idEfector) 
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""", atenciones_a_insertar)
    db.commit()
    
    # cursor.rowcount nos da el número exacto de filas nuevas insertadas (sin contar las ignoradas)
    atenciones_realmente_insertadas = cursor.rowcount

print(f"Atenciones nuevas insertadas efectivamente: {atenciones_realmente_insertadas}")

# =========================================================================
# VALIDACIÓN INTELIGENTE: Solo registrar en el histórico si hubo atenciones nuevas reales
# =========================================================================
if atenciones_realmente_insertadas > 0:
    cursor.execute("""
        INSERT INTO historial_importaciones 
        (periodo, filasHoja1, atencionesInsertadas, beneficiariosNuevos, efectoresNuevos, nomencladoresInsertados, estado, hashArchivo) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        periodo_formateado,
        len(df),
        atenciones_realmente_insertadas,
        len(nuevos_beneficiarios),
        len(nuevos_efectores),
        len(a_insertar_nom),
        'Completado',
        hash_archivo
    ))
    db.commit()
    print("Historial registrado correctamente.")
else:
    print("Aviso: El archivo no generó atenciones nuevas (ya se encontraba importado), no se crea registro histórico.")

print('¡PROCESO MENSUAL CARGADO CON ÉXITO!')

# JSON final para Node.js y React (usamos el contador real)
ya_cargado = atenciones_realmente_insertadas == 0
resumen = {
    "status": "duplicate" if ya_cargado else "success",
    "alreadyImported": ya_cargado,
    "hashArchivo": hash_archivo,
    "periodo": periodo_formateado,
    "mensaje": (
        "El archivo no generó atenciones nuevas; es probable que ya haya sido procesado."
        if ya_cargado else "¡Proceso mensual cargado con éxito!"
    ),
    "filasHoja1": len(df),
    "modulosNuevos": len(nuevos_modulos),
    "nomencladoresInsertados": len(a_insertar_nom),
    "nomencladoresActualizados": len(a_actualizar_nom),
    "beneficiariosNuevos": len(nuevos_beneficiarios),
    "efectoresNuevos": len(nuevos_efectores),
    "atencionesInsertadas": atenciones_realmente_insertadas,
}
print(json.dumps(resumen))