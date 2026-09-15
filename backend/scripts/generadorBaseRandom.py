from datetime import datetime, timedelta
import random
import openpyxl
import pandas as pd

# 1. Cargar archivo original
archivo_entrada = "BasePami.xlsx"
df_atenciones = pd.read_excel(archivo_entrada, sheet_name=0)
df_nomenclador = pd.read_excel(archivo_entrada, sheet_name=2)

columnas_originales = df_atenciones.columns
nomenclador_rows = df_nomenclador.to_dict("records")

# 2. Pools de datos ficticios (anonimizados para tesis con 10 efectores)
apellidos_pool = [
    "PEREZ",
    "GOMEZ",
    "RODRIGUEZ",
    "LOPEZ",
    "MARTINEZ",
    "GONZALEZ",
    "GARCIA",
    "ROJAS",
    "FERNANDEZ",
    "SILVA",
    "ACOSTA",
    "BENITEZ",
    "MEDINA",
    "ROMERO",
    "CABRAL",
    "SOTO",
    "RAMIREZ",
    "TORRES",
    "RUIZ",
    "DIAZ",
]
nombres_pool = [
    "JUAN CARLOS",
    "MARIA ROSA",
    "CARLOS ALBERTO",
    "ANA MARIA",
    "LUIS EDUARDO",
    "SILVIA BEATRIZ",
    "JORGE LUIS",
    "PATRICIA NOEMI",
    "MIGUEL ANGEL",
    "MONICA BEATRIZ",
    "ROBERTO CARLOS",
    "CLAUDIA ANDREA",
    "OSCAR DANIEL",
    "SANDRA LILIANA",
    "HECTOR RAUL",
    "ADRIANA BEATRIZ",
]

efectores_ficticios = [
    ("SANATORIO MODELO DEL NORTE", "10015 AV. FANTASIA 123 () - ", "SMN"),
    ("CLINICA MEDICA INTEGRAL", "20044 CALLE FALSA 456 () - ", "CMI"),
    ("HOSPITAL CENTENARIO FICTICIO", "30088 AV. SAN MARTIN 789 () - ", "HCF"),
    ("INSTITUTO DE SALUD COMUNITARIA", "40012 B° NUEVO 321 () - ", "ISC"),
    ("CENTRO MEDICO LOS SAUCES", "50099 LOS SAUCES 555 () - ", "MLS"),
    ("HOSPITAL REGIONAL DEL ESTE", "60111 RUTA NACIONAL 12 KM 5 () - ", "HRE"),
    ("SANATORIO NUEVA VIDA", "70222 9 DE JULIO 450 () - ", "SNV"),
    ("CLINICA SANTA TERESITA", "80333 BELGRANO 890 () - ", "CST"),
    ("HOSPITAL MUNICIPAL DE LA COSTA", "90444 COSTANERA SUR 100 () - ", "HMC"),
    (
        "CENTRO DE ESPECIALIDADES MEDICAS",
        "10555 CORRIENTES CAPITAL 1400 () - ",
        "CEM",
    ),
]

convenios_pool = ["NO VETERANO", "VETERANO"]
modalidades_pool = ["BENEFICIARIO PROPIO", "ORDEN PRESTACIÓN"]
tipo_atencion_pool = ["Ambulatorio", "Internacion"]

# 3. Generar 7000 filas para el periodo de Agosto 2024
num_filas = 7000
datos_ficticios = []
start_date = datetime(2024, 8, 1)

for i in range(num_filas):
  nro_prestacion = 50000 + i
  tipoatencion = random.choice(tipo_atencion_pool)

  # Fechas estrictamente dentro de Agosto 2024
  day_offset = random.randint(0, 30)
  hour = random.randint(8, 20)
  minute = random.randint(0, 59)
  dt = start_date + timedelta(days=day_offset, hours=hour, minutes=minute)

  fecha_prestacion = dt.strftime("%d-%b-%y").upper()
  f_prestacion = dt.strftime("%d/%m/%Y %H:%M")

  nro_beneficio = random.randint(111111100000, 999999999999)
  grado_parentesco = random.choice([0, 0, 0, 0, 1, 6])
  apellido_nombre = (
      f"{random.choice(apellidos_pool)} {random.choice(nombres_pool)}"
  )
  matricula = random.randint(1000, 99999)

  item_val = random.choice(nomenclador_rows)
  modulo = int(item_val["modulo"])
  nombre_modulo = (
      f"MODULO PRUEBA {modulo}" if modulo == 1 else f"PRACTICA LIBRE {modulo}"
  )
  practica = int(item_val["codPractica"])
  d_practica = item_val["DescripcionPractica"]
  valor_unitario = float(item_val["Valor GENERAL"])
  valor_total = valor_unitario

  cant = 1
  d_prestacion = "PRACTICA MEDICA"
  modalidad_p1 = random.choice(modalidades_pool)
  nro_orden_prestacion = (
      None
      if modalidad_p1 == "BENEFICIARIO PROPIO"
      else random.randint(9000000000, 9999999999)
  )

  efector_tuple = random.choice(efectores_ficticios)
  efector = efector_tuple[0]
  boca_atencion = efector_tuple[1]
  cod = efector_tuple[2]
  convenio = random.choice(convenios_pool)

  row = {
      "NRO_PRESTACION": nro_prestacion,
      "tipoatencion": tipoatencion,
      "FECHA_DE_PRESTACION": fecha_prestacion,
      "NRO_BENEFICIO": nro_beneficio,
      "GRADO_PARENTESCO": grado_parentesco,
      "APELLIDO_Y_NOMBRE": apellido_nombre,
      "MODALIDAD_PRESTACION": None,
      "NRO_ORDEN_DE_PRESTACION": None,
      "MATRICULA": matricula,
      "MODULO": modulo,
      "NOMBRE_MODULO": nombre_modulo,
      "PRACTICA": practica,
      "D_PRACTICA": d_practica,
      "F_PRACTICA": f_prestacion,
      "CANT.": cant,
      "D_PRESTACION": d_prestacion,
      "MODALIDAD_PRESTACION.1": modalidad_p1,
      "NRO_ORDEN_PRESTACION_PRACTICA": nro_orden_prestacion,
      "BOCA_ATENCION": boca_atencion,
      "Valor\n Unitario": valor_unitario,
      "Valor Total": valor_total,
      "BA\nExterna": None,
      "Efector": efector,
      "CONVENIO": convenio,
      "OBSERVACIONES": None,
      "para banco de sangre y laboratorio": efector,
      "cod": cod,
      "Cant.\nDébito": None,
      "Debito": 0,
  }
  datos_ficticios.append(row)

df_generated = pd.DataFrame(datos_ficticios, columns=columnas_originales)

# 4. Guardar archivo preservando intactas las demás hojas originales
wb_orig = openpyxl.load_workbook(archivo_entrada)
archivo_salida = "BasePami_Ficticia_Agosto_7000.xlsx"

with pd.ExcelWriter(archivo_salida, engine="openpyxl") as writer:
  df_generated.to_excel(writer, sheet_name="Hoja1", index=False)
  for sheet_name in wb_orig.sheetnames:
    if sheet_name == "Hoja1":
      continue
    df_sheet = pd.read_excel(archivo_entrada, sheet_name=sheet_name)
    df_sheet.to_excel(writer, sheet_name=sheet_name, index=False)

print(
    f"¡Archivo generado con éxito: '{archivo_salida}' con periodos de agosto y"
    " 10 efectores ficticios!"
)