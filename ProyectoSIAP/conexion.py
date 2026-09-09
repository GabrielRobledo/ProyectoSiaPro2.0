import sys

import MySQLdb
import pandas as pd
import numpy as np
import sys



# Crear la conexión con MySQL
db = MySQLdb.connect(host='localhost', user='root', db='db_siap')
cursor = db.cursor()
print('CONEXION EXITOSA')

if len(sys.argv) > 1:
    file_path = sys.argv[1]
else:
    print("Error: No se recibió la ruta del archivo")
    sys.exit(1)

# Verificar que el usuario seleccionó un archivo
if file_path:
    # Leer el archivo Excel en un DataFrame
    df = pd.read_excel(file_path, sheet_name='Detalle_Practicas')

else:
    print("No se seleccionó ningún archivo.")

# Crear tablas si no existen
cursor.execute("""
CREATE TABLE IF NOT EXISTS Beneficiario (
    idBeneficiario int AUTO_INCREMENT primary key,
    apeYnom varchar(100) not null,
    NroBeneficiario varchar(50) not null);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS TipoUsuario(
    idTipo int auto_increment primary key,
    descripcion varchar(50) not null);"""
)

cursor.execute("""SELECT * FROM TipoUsuario""")
ids = cursor.fetchone()
if ids is None:
    #inserto los 3 tipos de usuarios permitidos
    cursor.execute(f"""
    INSERT INTO TipoUsuario (descripcion) VALUES ("Administrador")""")
    cursor.execute(f"""
    INSERT INTO TipoUsuario (descripcion) VALUES ("SuperUser")""")
    cursor.execute(f"""
    INSERT INTO TipoUsuario (descripcion) VALUES ("User")""")


cursor.execute("""
CREATE TABLE IF NOT EXISTS Usuario(
    idUsuario int auto_increment primary key,
    dni int not null,
    contraseña varchar(50) not null,
    idTipo int not null,
    FOREIGN KEY (idTipo) REFERENCES TipoUsuario (idTipo)); 
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS Efector (
    idEfector int AUTO_INCREMENT primary key,
    codPrestador varchar(10) not null,
    RazonSocial varchar(100) not null);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS Modulo (
    idModulo int primary key,
    descripcion varchar(100) not null);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS VigenciaNomenclador (
    idVigencia int auto_increment primary key,
    periodo varchar(100) not null);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS Nomenclador (
    idNomenclador int auto_increment primary key,
    codPractica int not null,
    descripcion varchar(100) not null,
    idModulo int not null,
    idVigencia int not null,           
    FOREIGN KEY(idModulo) REFERENCES Modulo(idModulo),
    FOREIGN KEY (idVigencia) REFERENCES VigenciaNomenclador (idVigencia));
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS Nomenclador_Importes (
    idNomencladorImporte int AUTO_INCREMENT primary key,
    idNomenclador int not null,
    periodo varchar(100) not null,
    importe double(20,2),
    FOREIGN KEY (idNomenclador) REFERENCES Nomenclador (idNomenclador));
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS Atencion (
    idAtencion int auto_increment primary key,
    tipoAtencion varchar(50) not null,
    fecha varchar(50) not null,
    idBeneficiario int not null,
    ModPrestacion_1 varchar (50),
    Nro_OP_1 bigint null,
    matricula int null,
    idNomenclador int not null,
    D_Prestacion varchar(50),
    ModPrestacion_2 varchar(50),
    Nro_OP_2 bigint null,
    fechaPractica varchar(50),
    cantidad int,
    valorTotal double(20,2),
    idEfector int not null,
    convenio varchar(50),
    periodo varchar(50) not null,
    FOREIGN KEY(idBeneficiario) REFERENCES Beneficiario(idBeneficiario),
    FOREIGN KEY(idNomenclador) REFERENCES Nomenclador(idNomenclador),
    FOREIGN KEY(idEfector) REFERENCES Efector(idEfector));
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS ome(
    idOme int auto_increment primary key not null,
    nroOrden bigint not null,
    fecha varchar(50) not null,
    idNomenclador int not null,
    idBeneficiario int not null,
    turno varchar(50) not null,
    userAcepto varchar(50) not null,
    fechaacepto varchar(50) not null,
    transmitido varchar(10),
    fechaTransmision varchar(50) not null,
    userTransmision varchar(50) not null,
    validacion varchar(10),
    fechavalidacion varchar(50),
    uservalidacion varchar(50),
    idEfector int not null,
    valor double(20,2),
    periodo varchar(50) not null,
    FOREIGN KEY (idBeneficiario) REFERENCES Beneficiario (idBeneficiario),
    FOREIGN KEY (idNomenclador) REFERENCES Nomenclador (idNomenclador),
    FOREIGN KEY (idEfector) REFERENCES Efector (idEfector))""")

# Inserción de beneficiarios
for index, row in df.iloc[5:].iterrows():
  
    nrobene = str(df.iloc[index, 3]) + "-" + str(df.iloc[index, 4])
    cursor.execute(f"""SELECT idBeneficiario FROM Beneficiario WHERE NroBeneficiario = '{nrobene}'""")
    result = cursor.fetchone()
    if result is None:
        cursor.execute("""
        INSERT INTO Beneficiario (apeYnom, NroBeneficiario) 
        VALUES (%s, %s)""", (df.iloc[index, 5], nrobene))
db.commit()

# Inserción de efectores
for index, row in df.iloc[5:].iterrows():
    cursor.execute(f"""SELECT idEfector FROM Efector WHERE codPrestador = '{df.iloc[index, 26]}'""")
    result = cursor.fetchone()
    if result is None:
        cursor.execute("""
        INSERT INTO Efector (codPrestador, RazonSocial) 
        VALUES (%s, %s)""", (df.iloc[index, 26], df.iloc[index, 22]))
db.commit()

# Leer y procesar la hoja 3 para nomencladores y módulos
dfNomen = pd.read_excel(file_path, sheet_name='nomenclador')
periodo=dfNomen.iloc[2, 0]
cursor.execute(f"""
        INSERT INTO VigenciaNomenclador (periodo) 
        VALUES ('{periodo}')""")
db.commit()

idVigen = cursor.execute("""SELECT LAST_INSERT_ID(idVigencia) FROM vigencianomenclador;""")

# Inserción de módulos y nomencladores
for index, row in dfNomen.iloc[5:].iterrows():
    cursor.execute(f"""SELECT idModulo FROM Modulo WHERE idModulo = {dfNomen.iloc[index, 0]}""")
    result = cursor.fetchone()
    if result is None:
        cursor.execute("""
        INSERT INTO Modulo (idModulo, descripcion) 
        VALUES (%s, %s)""", (dfNomen.iloc[index, 0], dfNomen.iloc[index, 18]))

    cursor.execute(f"""SELECT idNomenclador FROM Nomenclador WHERE codPractica = {dfNomen.iloc[index, 1]}""")
    result = cursor.fetchone()
    if result is None:
        cursor.execute("""
        INSERT INTO Nomenclador (codPractica, descripcion, idModulo, idVigencia) 
        VALUES (%s, %s, %s, %s)""", (dfNomen.iloc[index, 1], dfNomen.iloc[index, 3], dfNomen.iloc[index, 0], idVigen))    
db.commit()

#Insercion de Importes de cada practica nomenclada
for index, row in dfNomen.iloc[5:].iterrows():
    
    cursor.execute(f"""SELECT idNomenclador FROM Nomenclador WHERE codPractica = {dfNomen.iloc[index, 1]}""")
    idNom = cursor.fetchone()
    if idNom is None:
        print("PRACTICA NO NOMENCLADA!!!")
        continue
    cursor.execute("""
        INSERT INTO Nomenclador_Importes (idNomenclador, periodo, importe) 
        VALUES (%s, %s, %s)""", (idNom, periodo, dfNomen.iloc[index, 4]))
db.commit() 

# Inserción de atenciones
for index, row in df.iloc[5:].iterrows():
    cursor.execute(f"""SELECT idNomenclador FROM Nomenclador WHERE codPractica = {df.iloc[index, 11]}""")
    idNom = cursor.fetchone()
    if idNom is None:
        print("PRACTICA NO NOMENCLADA!!!")
        continue

    nrobene = str(df.iloc[index, 3]) + "-" + str(df.iloc[index, 4])
    cursor.execute(f"""SELECT idBeneficiario FROM Beneficiario WHERE NroBeneficiario = '{nrobene}'""")
    idBen = cursor.fetchone()

    cursor.execute(f"""SELECT idEfector FROM Efector WHERE codPrestador = '{df.iloc[index, 26]}'""")
    idEfec = cursor.fetchone()

    op1 = "'" + str(df.iloc[index, 7]) + "'"
    mat ="'" + str(df.iloc[index, 8]) + "'"
    op2 = "'" + str(df.iloc[index, 17]) + "'"
    mesFactu = df.iloc[1, 1]
    cursor.execute(f"""
    INSERT INTO Atencion (tipoAtencion, fecha, idBeneficiario, ModPrestacion_1, Nro_OP_1 , matricula, idNomenclador, D_Prestacion,  ModPrestacion_2, Nro_OP_2, fechaPractica, cantidad, valorTotal, idEfector, convenio, periodo)
    VALUES ('{df.iloc[index, 1]}', '{df.iloc[index, 2]}', {idBen[0]}, '{df.iloc[index, 6]}', {op1}, {mat}, {idNom[0]}, '{df.iloc[index, 15]}', '{df.iloc[index, 16]}', {op2}, '{df.iloc[index, 13]}', {df.iloc[index, 14]}, {df.iloc[index, 20]}, {idEfec[0]}, '{df.iloc[index, 23]}', '{mesFactu}')""")   
db.commit()

#Insercion de OMES
dfOme = pd.read_excel(file_path, sheet_name='OME')

for index, row in dfOme.iloc[1:].iterrows():
    cursor.execute(f"""SELECT idNomenclador FROM Nomenclador WHERE codPractica = '{dfOme.iloc[index, 16]}'""")
    nome = cursor.fetchone()
    cursor.execute(f"""SELECT idEfector FROM Efector WHERE codPrestador = '{dfOme.iloc[index, 14]}'""")
    hosp = cursor.fetchone()
    nro = str(dfOme.iloc[index, 2])
    nroset = nro[:-2] + '-' + nro[-2:]
    cursor.execute(f"""SELECT idBeneficiario FROM Beneficiario WHERE NroBeneficiario = '{nroset}'""")
    bene = cursor.fetchone()

    if nome is None:
        print(dfOme.iloc[index, 16])
        print("practica no registrada!!!")
        continue

    if (hosp is None) and (bene is None):
        cursor.execute("""
        INSERT INTO Efector (codPrestador, RazonSocial) 
        VALUES (%s, %s)""", (dfOme.iloc[index, 14], dfOme.iloc[index, 15]))
        cursor.execute(f"""SELECT idEfector FROM Efector WHERE codPrestador = '{dfOme.iloc[index, 14]}'""")
        hosp = cursor.fetchone()
        cursor.execute("""
        INSERT INTO Beneficiario (apeYnom, NroBeneficiario) 
        VALUES (%s, %s)""", (dfOme.iloc[index, 3], nroset))
        cursor.execute(f"""SELECT idBeneficiario FROM Beneficiario WHERE NroBeneficiario = '{nroset}'""")
        bene = cursor.fetchone()
        cursor.execute(f"""     
        INSERT INTO ome (nroOrden, fecha, idNomenclador, idBeneficiario, turno, userAcepto, fechaacepto, transmitido, fechaTransmision, userTransmision, validacion, fechaValidacion, uservalidacion, idEfector, valor, periodo)
        VALUES ({dfOme.iloc[index, 0]}, '{dfOme.iloc[index, 1]}', {nome[0]}, {bene[0]}, '{dfOme.iloc[index, 5]}', '{dfOme.iloc[index, 6]}', '{dfOme.iloc[index, 7]}', '{dfOme.iloc[index, 8]}', '{dfOme.iloc[index, 9]}', '{dfOme.iloc[index, 10]}', '{dfOme.iloc[index, 11]}', '{dfOme.iloc[index, 12]}', '{dfOme.iloc[index, 13]}', {hosp[0]}, {dfOme.iloc[index, 18]}, '{mesFactu}')""")   
        continue

    if hosp is None:
        cursor.execute("""
        INSERT INTO Efector (codPrestador, RazonSocial) 
        VALUES (%s, %s)""", (dfOme.iloc[index, 14], dfOme.iloc[index, 15]))
        cursor.execute(f"""SELECT idEfector FROM Efector WHERE codPrestador = '{dfOme.iloc[index, 14]}'""")
        hosp = cursor.fetchone()
        cursor.execute(f"""     
        INSERT INTO ome (nroOrden, fecha, idNomenclador, idBeneficiario, turno, userAcepto, fechaacepto, transmitido, fechaTransmision, userTransmision, validacion, fechaValidacion, uservalidacion, idEfector, valor, pediodo)
        VALUES ({dfOme.iloc[index, 0]}, '{dfOme.iloc[index, 1]}', {nome[0]}, {bene[0]}, '{dfOme.iloc[index, 5]}', '{dfOme.iloc[index, 6]}', '{dfOme.iloc[index, 7]}', '{dfOme.iloc[index, 8]}', '{dfOme.iloc[index, 9]}', '{dfOme.iloc[index, 10]}', '{dfOme.iloc[index, 11]}', '{dfOme.iloc[index, 12]}', '{dfOme.iloc[index, 13]}', {hosp[0]}, {dfOme.iloc[index, 18]}, ''{mesFactu})""")   
        continue

    if bene is None:
        cursor.execute("""
        INSERT INTO Beneficiario (apeYnom, NroBeneficiario) 
        VALUES (%s, %s)""", (dfOme.iloc[index, 3], nroset))
        cursor.execute(f"""SELECT idBeneficiario FROM Beneficiario WHERE NroBeneficiario = '{nroset}'""")
        bene = cursor.fetchone()
        cursor.execute(f"""     
        INSERT INTO ome (nroOrden, fecha, idNomenclador, idBeneficiario, turno, userAcepto, fechaacepto, transmitido, fechaTransmision, userTransmision, validacion, fechaValidacion, uservalidacion, idEfector, valor, periodo)
        VALUES ({dfOme.iloc[index, 0]}, '{dfOme.iloc[index, 1]}', {nome[0]}, {bene[0]}, '{dfOme.iloc[index, 5]}', '{dfOme.iloc[index, 6]}', '{dfOme.iloc[index, 7]}', '{dfOme.iloc[index, 8]}', '{dfOme.iloc[index, 9]}', '{dfOme.iloc[index, 10]}', '{dfOme.iloc[index, 11]}', '{dfOme.iloc[index, 12]}', '{dfOme.iloc[index, 13]}', {hosp[0]}, {dfOme.iloc[index, 18]}, '{mesFactu}')""")   
        continue

    cursor.execute(f"""     
        INSERT INTO ome (nroOrden, fecha, idNomenclador, idBeneficiario, turno, userAcepto, fechaacepto, transmitido, fechaTransmision, userTransmision, validacion, fechaValidacion, uservalidacion, idEfector, valor, periodo)
        VALUES ({dfOme.iloc[index, 0]}, '{dfOme.iloc[index, 1]}', {nome[0]}, {bene[0]}, '{dfOme.iloc[index, 5]}', '{dfOme.iloc[index, 6]}', '{dfOme.iloc[index, 7]}', '{dfOme.iloc[index, 8]}', '{dfOme.iloc[index, 9]}', '{dfOme.iloc[index, 10]}', '{dfOme.iloc[index, 11]}', '{dfOme.iloc[index, 12]}', '{dfOme.iloc[index, 13]}', {hosp[0]}, {dfOme.iloc[index, 18]}, '{mesFactu}')""")   
db.commit()

print('REGISTROS CARGADOS CON EXITO!!!')