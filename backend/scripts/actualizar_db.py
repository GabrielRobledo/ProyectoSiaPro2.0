import sys
import MySQLdb
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv

# Si usas un archivo .env en el backend, esto levanta las variables de entorno
load_dotenv()

# CREAR LA CONEXIÓN CON MYSQL
db = MySQLdb.connect(
    host=os.getenv('DB_HOST', 'localhost'),
    user=os.getenv('DB_USER', 'root'),
    passwd=os.getenv('DB_PASSWORD', ''),
    db=os.getenv('DB_NAME', 'db_siap'),
    port=int(os.getenv('DB_PORT', 3306)),
    ssl={
        "ssl": os.getenv('DB_SSL', 'false').lower() == 'true'
    }
)
cursor = db.cursor()
print('CONEXIÓN EXITOSA')

# OBTENER LA RUTA DEL EXCEL
if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    file_path = 'BasePami.xlsx'

print(f"Procesando archivo: {file_path}")

try:
    df = pd.read_excel(file_path, sheet_name='Hoja1')
    # Hoja3 tiene los encabezados reales en la fila 5
    dfNomen = pd.read_excel(file_path, sheet_name='Hoja3', header=5)
    
    print(f"Filas encontradas en Hoja1: {len(df)}")
    print(f"Filas encontradas en Hoja3: {len(dfNomen)}")
except Exception as e:
    print(f"Error al leer las hojas del Excel: {e}")
    sys.exit(1)

# 1. CREAR TABLAS PRINCIPALES
cursor.execute("""CREATE TABLE IF NOT EXISTS Modulos(
                    idModulo int primary key,
                    descripcion varchar(100) not null);
               """)

cursor.execute("""CREATE TABLE IF NOT EXISTS Beneficiarios(
                    idBeneficiario int AUTO_INCREMENT primary key,
                    apeYnom varchar(100) not null,
                    NroBeneficiario varchar(50) not null);
               """)

cursor.execute("""CREATE TABLE IF NOT EXISTS Efectores(
                    idEfector int AUTO_INCREMENT primary key,
                    codPrestador varchar(10) not null,
                    RazonSocial varchar(100) not null);
               """)

cursor.execute("""CREATE TABLE IF NOT EXISTS Nomencladores(
                    idNomenclador int auto_increment primary key,
                    codPractica int not null,
                    descripcion varchar(100) not null,
                    valorGeneral double(20,2) not null,
                    idModulo int not null,
                    FOREIGN KEY(idModulo) REFERENCES Modulos(idModulo));
               """)

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
                    FOREIGN KEY(idEfector) REFERENCES Efectores(idEfector));
               """)
print("Tablas verificadas/creadas correctamente.")

# 2. INSERTO MÓDULOS (Desde la Hoja 1)
print("Insertando Módulos...")
mod_count = 0
for index, row in df.iterrows():
    mod_val = row.get("MODULO")
    mod_nombre = row.get("NOMBRE_MODULO")
    
    if pd.isna(mod_val) or pd.isna(mod_nombre):
        continue
    
    try:
        mod_id = int(mod_val)
    except (ValueError, TypeError):
        continue
        
    cursor.execute("SELECT idModulo FROM Modulos WHERE idModulo = %s", (mod_id,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO Modulos (idModulo, descripcion) VALUES (%s, %s)", 
                       (mod_id, str(mod_nombre)))
        mod_count += 1
db.commit()
print(f"Módulos procesados. Nuevos insertados: {mod_count}")

# 3. INSERTO BENEFICIARIOS
print("Insertando Beneficiarios...")
ben_count = 0
for index, row in df.iterrows():
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except (ValueError, TypeError):
        continue
        
    cursor.execute("SELECT idBeneficiario FROM Beneficiarios WHERE NroBeneficiario = %s", (nrobene,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO Beneficiarios (apeYnom, NroBeneficiario) VALUES (%s, %s)", 
                       (str(row["APELLIDO_Y_NOMBRE"]), nrobene))
        ben_count += 1
db.commit()
print(f"Beneficiarios procesados. Nuevos insertados: {ben_count}")

# 4. INSERTO EFECTORES
print("Insertando Efectores...")
efe_count = 0
for index, row in df.iterrows():
    cod_pres = row.get("cod")
    if pd.isna(cod_pres):
        continue
    cursor.execute("SELECT codPrestador FROM Efectores WHERE codPrestador = %s", (str(cod_pres),))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO Efectores (codPrestador, RazonSocial) VALUES (%s, %s)", 
                       (str(cod_pres), str(row.get("Efector", "Sin nombre"))))
        efe_count += 1
db.commit()
print(f"Efectores procesados. Nuevos insertados: {efe_count}")

# 5. INSERTO NOMENCLADORES (Desde la Hoja 3 con rótulos corregidos)
print("Insertando Nomencladores...")
nom_count = 0
for index, row in dfNomen.iterrows():
    cod_prac_val = row.get("codPractica")
    if pd.isna(cod_prac_val): 
        continue

    try:
        cod_prac = int(cod_prac_val)
    except (ValueError, TypeError):
        continue

    cursor.execute("SELECT idNomenclador FROM Nomencladores WHERE codPractica = %s", (cod_prac,))
    if cursor.fetchone() is None:
        descripcion = str(row.get("DescripcionPractica", "Sin descripción")).replace('"', '')
        
        raw_val = row.get("Valor GENERAL", 0.0)
        valor_gen = float(raw_val) if not pd.isna(raw_val) else 0.0
        
        mod_val = row.get("modulo")
        if pd.isna(mod_val):
            continue
        try:
            mod_id = int(mod_val)
        except (ValueError, TypeError):
            continue
        
        cursor.execute("SELECT idModulo FROM Modulos WHERE idModulo = %s", (mod_id,))
        if cursor.fetchone() is not None:
            cursor.execute("""INSERT INTO Nomencladores (codPractica, descripcion, valorGeneral, idModulo) 
                              VALUES (%s, %s, %s, %s)""", 
                             (cod_prac, descripcion, valor_gen, mod_id))
            nom_count += 1
db.commit()
print(f"Nomencladores procesados. Nuevos insertados: {nom_count}")

# 6. INSERTO ATENCIONES
print("Insertando Atenciones...")
atn_count = 0
for index, row in df.iterrows():
    if pd.isna(row.get("NRO_BENEFICIO")) or pd.isna(row.get("GRADO_PARENTESCO")):
        continue
    
    try:
        nrobene = str(int(row["NRO_BENEFICIO"])) + "-0" + str(int(row["GRADO_PARENTESCO"]))
    except (ValueError, TypeError):
        continue

    cursor.execute("SELECT idBeneficiario FROM Beneficiarios WHERE NroBeneficiario = %s", (nrobene,))
    res_ben = cursor.fetchone()
    if not res_ben:
        continue
    idBen = res_ben[0]

    cursor.execute("SELECT idNomenclador FROM Nomencladores WHERE codPractica = %s", (row.get("PRACTICA"),))
    res_nom = cursor.fetchone()
    if not res_nom:
        continue
    idNom = res_nom[0]

    cursor.execute("SELECT idEfector FROM Efectores WHERE codPrestador = %s", (str(row.get("cod")),))
    res_efe = cursor.fetchone()
    if not res_efe:
        continue
    idEfec = res_efe[0]

    raw_valor_total = row.get("Valor Total", 0)
    valor_total = float(raw_valor_total) if not pd.isna(raw_valor_total) else 0.0

    raw_cant = row.get("CANT.", 1)
    cantidad = int(raw_cant) if not pd.isna(raw_cant) else 1

    if row.get("D_PRESTACION") == "PRACTICA MEDICA":
        cursor.execute("""INSERT INTO Atenciones 
                          (tipoAtencion, fecha, idBeneficiario, idNomenclador, fechaPractica, cantidad, valorTotal, idEfector) 
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                       (str(row.get("tipoatencion", "")), str(row.get("FECHA_DE_PRESTACION", "")), idBen, idNom, str(row.get("F_PRACTICA", "")),
                        cantidad, valor_total, idEfec))
        atn_count += 1
db.commit()
print(f"Atenciones procesadas. Nuevas insertadas: {atn_count}")

print('REGISTROS CARGADOS CON ÉXITO')