quiero que analisis a profundidad el contenido de cada  uno de los archivos del proyecto actual:

10.Pruebas_riesgos_criterios_MVP_gestion_ubicaciones_eventos.md
10_Prompt de pruebas, riesgos y criterios de aceptación.md
9.Plan_desarrollo_MVP_gestion_ubicaciones_eventos.md
9_Prompt de plan de desarrollo.md
8.APIs_y_contratos_gestion_ubicaciones_eventos.md
8_Prompt de APIs y contratos.md
7.Arquitectura_tecnica_gestion_ubicaciones_eventos.md
7_Prompt de arquitectura técnica.md
6.Motor_layout_y_asignacion_gestion_ubicaciones_eventos.md
6_Prompt del motor de layout y asignación de mesas.md
5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md
5_Prompt de UX_UI y flujos de pantalla.md
4.Modelo_de_datos_gestion_ubicaciones_eventos.md
4_Prompt de modelo de datos.md
3.Casos_de_uso_y_requerimientos_funcionales.md
3_Prompt de casos de uso y requerimientos funcionales.md
2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md
2_Prompt de reglas de negocio.md
1.Definicion_producto_gestion_ubicaciones_eventos.md
1_Prompt maestro de entendimiento del producto.md
 

---

Actúa como un equipo experto auditor y garante compuesto por:
- Product Manager senior,
- Analista de Negocio,
- Arquitecto de Software,
- Arquitecto de Datos,
- UX Designer,
- Technical Lead.

Necesito que analices, estructures y valides el MVP de una aplicación web para reserva de cupos en mesas para un evento.

Contexto del negocio:
Existe una base de datos con un código único por estudiante. Cada estudiante o familia podrá ingresar a una página usando ese código único.

Una vez dentro, el usuario debe poder:
- visualizar el mapa del evento,
- ver las mesas disponibles,
- seleccionar una mesa,
- indicar cuántos puestos quiere reservar en esa mesa.

Reglas del sistema:
- cada mesa tiene 10 puestos,
- el usuario no escoge silla específica,
- solo reserva una cantidad de puestos dentro de una mesa,
- si reserva 3 puestos en una mesa, esa mesa queda con 7 disponibles,
- cada código de estudiante tendrá una etapa inicial de preventa en la que podrá comprar hasta 4 boletas,
- después de esa etapa, solo podrá comprar hasta 3 boletas,
- el sistema debe generar un código único de reserva el usuario realice el pago y este sea comprobado, el pago se realiza por fuera de la aplicación,
- el pago se realizará externamente, no dentro del sistema,
- el sistema debe registrar quién realizó la compra, y su respectiva evidencia para ser aprobado.
- por cada asistente se deben capturar:
  - nombres y apellidos,
  - número de cédula,
  - si es vegetariano o no,
  - si tiene alguna alergia.

Se requiere un sistema permita al administrador el cargue masivo de una base de datos de estudiantes (CSV o Excel) con un código único. Cada estudiante podrá ingresar a la plataforma usando ese código.

FLUJO DEL NEGOCIO:

1. El estudiante ingresa con su código.
2. Puede registrar los datos de los asistentes:
   - nombre
   - cédula
   - vegetariano
   - alergias
3. Debe subir un comprobante de pago. indicando el numero de sillas pagadas para su reserva
    * Selecciona la cantidad de boletas compradas:
   - Preventa: máximo 4
   - Venta general: máximo 3
    * Puede:
   - completar editar o eliminar el registro de su pago solo hasta que el organizador apruebe. una vez aprobado el recibido del pago no podra editar o eliminar el comprobante de pago y el numero de sillas reservadas.
4. El comité organizador valida el pago:
   - aprobado
   - rechazado
5. Solo si el pago es aprobado:
   - el usuario puede seleccionar una mesa
   - selecciona una mesa y el sistema asigna los cupos disponibles
6. Cada mesa tiene 10 cupos.
7. No se selecciona silla individual, solo cantidad de cupos.

8. Se genera un código único de reserva que incluye:
   - mesa
   - cantidad de cupos
   - relación con pago
   - codigo del estudiante unico de la reserva

TIPOS DE PAGO:
- Digital (usuario sube comprobante)
- Efectivo (comité registra y sube evidencia)

Objetivo:
Evaluar si el MVP del sistema propuesto cumple con las reglas y alcances descritos 

Quiero que entregues la respuesta unificada en un 1 archivo Markdown .md con un analisis de brecha detallado en caso que no se considere que la solucion planteada sea viable aterrizando y proponiendo definiciones concretas a las ambiguedades que puedan existir. el objetivo es garantizar una usabilidad eficiente la plataforma tanto para administradores como para usuarios finales participantes de los eventos facilitando la gestion de asignacion de sillas mesas y validaicones de pagos correspondientes al evento. 