Actúa como un Product Manager senior, Analista de Negocio y Arquitecto de Soluciones especializado en plataformas de gestión de eventos, reservas de mesas, pagos externos con conciliación manual y sistemas transaccionales.

Necesito que analices y estructures profesionalmente la siguiente idea de producto digital, tomando como línea base obligatoria estas reglas del negocio:

Contexto del negocio:
- existe una base de datos con un código único por estudiante,
- cada estudiante o familia ingresa a la plataforma usando ese código,
- cada código de estudiante puede usarse una sola vez por evento,
- el administrador debe poder cargar masivamente estudiantes y códigos por CSV o Excel,
- el archivo de importación contiene exactamente tres columnas: `codigo_unico`, `apellidos`, `nombres`.

Flujo de negocio obligatorio del MVP:
1. El estudiante ingresa con su código único.
2. Registra los datos de los asistentes:
   - nombres y apellidos,
   - tipo de documento,
   - número de documento,
   - si es vegetariano o no,
   - si tiene alergias,
   - número celular,
   - nombre y teléfono de contacto de emergencia,
   - si tiene movilidad reducida o usa silla de ruedas.
3. Registra un pago realizado fuera de la aplicación:
   - selecciona cuántas boletas compró,
   - en preventa puede comprar máximo 4,
   - en venta general puede comprar máximo 3,
   - sube el comprobante si el pago es digital,
   - puede crear, editar o eliminar el registro del pago solo hasta que el comité lo apruebe.
4. El comité organizador revisa el pago:
   - aprobado,
   - rechazado.
5. Solo si el pago es aprobado:
   - el usuario puede ver y usar el mapa del evento,
   - selecciona una o varias mesas,
   - indica cuántos cupos reservará en cada mesa.
6. Antes de confirmar la reserva, el usuario debe aceptar la política de tratamiento de datos y los términos y condiciones vigentes del evento.
7. Si acepta, el sistema registra esa aceptación para toda la reserva y para todos los asistentes asociados.
8. El sistema genera un código único de reserva vinculado al pago aprobado, a la mesa y al código del estudiante.

Reglas de reserva del MVP:
- cada mesa tiene 10 cupos,
- el usuario no escoge silla específica,
- solo reserva una cantidad de cupos dentro de una mesa,
- si reserva 3 cupos en una mesa, esa mesa queda con 7 disponibles,
- el pago se realiza fuera del sistema,
- el sistema debe soportar pago digital y pago en efectivo,
- para pago en efectivo el comité registra la evidencia,
- no existe pre-reserva temporal tipo HOLD,
- no existe selección individual de sillas,
- el organizador puede intervenir manualmente si la operación lo requiere.
- el comprador puede editar asistentes hasta 20 días antes de la fecha del evento,
- después de ese umbral solo el administrador del sistema puede editar asistentes,
- las cancelaciones y devoluciones no se gestionan dentro de la aplicación,
- una corrección manual del comité no obliga a regenerar códigos de reserva,
- los códigos de reserva deben ser secuenciales por asistente dentro del evento.
- el sistema debe permitir administrar por CRUD la política de tratamiento de datos y los términos y condiciones del evento,
- si el comprador no acepta ambos documentos, no puede completar la selección de mesas y cupos,
- al aceptar durante la reserva, todos los asistentes vinculados a esa reserva quedan cubiertos por esa aceptación.

Objetivo:
Transformar esta idea en una definición clara, realista y consistente del producto, sin arrastrar supuestos de modelos anteriores basados en `Seat`, `HOLD`, magic link o confirmación por webhook como flujo principal.

Entrega la respuesta en 1 archivo Markdown `.md` con este formato:

1. Resumen ejecutivo del producto
2. Problema que resuelve
3. Contexto operativo del negocio
4. Tipos de eventos soportados
5. Tipos de usuarios/actores
6. Objetivos del negocio
7. Objetivos operativos
8. Alcance inicial (MVP)
9. Alcance futuro
10. Lista de funcionalidades principales
11. Reglas rectoras del MVP
12. Supuestos
13. Riesgos y vacíos de información
14. Preguntas críticas que deberían resolverse antes de diseñar o desarrollar
15. Recomendación de enfoque de implementación por fases

Instrucciones adicionales:
- Sé explícito, concreto y orientado a producto real.
- No inventes reglas que contradigan el contexto dado.
- Cuando asumas algo, márcalo como supuesto.
- Si detectas ambigüedades, propón una definición concreta para el MVP y justifícala.
- El resultado debe dejar trazabilidad clara hacia reglas de negocio, modelo de datos, UX, APIs y pruebas.