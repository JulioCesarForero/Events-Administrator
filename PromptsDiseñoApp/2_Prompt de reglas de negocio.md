Actúa como un Analista de Negocio senior experto en reglas de negocio para plataformas de eventos, conciliación manual de pagos y reserva de cupos en mesas.

A partir del documento de producto:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`

necesito que identifiques, estructures y formalices todas las reglas de negocio necesarias para el MVP real.

Objetivo:
Construir un catálogo formal de reglas de negocio para una aplicación web donde:

- el acceso del comprador se hace por `codigo_estudiante`,
- el administrador importa estudiantes por CSV o Excel,
- el usuario registra asistentes y un pago externo,
- el comité aprueba o rechaza el pago,
- solo con pago aprobado se habilita el mapa,
- la reserva se hace por **cupos en mesa**,
- cada mesa tiene **10 cupos**,
- no existe `Seat`,
- no existe `HOLD`,
- no existe confirmación automática por webhook como flujo principal.

Analiza especialmente:

- autenticación por código único,
- regla de un solo uso del código por evento,
- importación masiva de estudiantes,
- administración de política de tratamiento de datos y términos del evento,
- gestión de asistentes y datos obligatorios,
- política temporal de edición de asistentes hasta 20 días antes del evento,
- relación entre boletas compradas, etapa comercial y pago reportado,
- estados del pago (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`),
- edición o eliminación del pago antes de aprobación,
- habilitación del mapa solo tras aprobación,
- reserva por cantidad de cupos en una mesa,
- reserva multi-mesa en una sola operación,
- aceptación obligatoria de políticas y términos antes de reservar,
- capacidad disponible por mesa,
- concurrencia al reservar cupos en la misma mesa,
- generación de códigos secuenciales de reserva por asistente,
- intervención manual del organizador,
- pagos digitales y pagos en efectivo,
- escenarios de rechazo, corrección, sobreocupación e inconsistencias,
- exclusión explícita de cancelación de reserva y devolución de pago dentro de la app.

Entrega la respuesta en 1 archivo Markdown `.md` con este formato:

1. Catálogo de reglas de negocio
   - ID de regla
   - Nombre
   - Descripción formal
   - Justificación
   - Actor involucrado
   - Precondiciones
   - Resultado esperado
   - Excepciones
2. Reglas críticas que deben implementarse en backend
3. Reglas que también deben validarse en frontend
4. Ambigüedades detectadas
5. Recomendaciones para convertir estas reglas en historias de usuario y criterios de aceptación

Instrucciones adicionales:

- Usa lenguaje normativo y preciso.
- Prioriza reglas implementables.
- No arrastres conceptos del diseño anterior como `Seat`, `hold_timeout`, `hold_expires_at`, `magic link` o `checkout` dentro de la aplicación.
- Si detectas una ambigüedad, propón una definición concreta para el MVP.