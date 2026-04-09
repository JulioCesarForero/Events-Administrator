Actúa como un Business Analyst y Product Owner senior especializado en diseño funcional de plataformas SaaS para eventos, conciliación manual y reservas espaciales.

Con base en:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`

Objetivo:
Descomponer la solución en módulos, requerimientos funcionales, no funcionales y casos de uso priorizados, manteniendo una sola línea base funcional para el MVP.

La solución debe asumir obligatoriamente que:

- el comprador entra con `codigo_estudiante`,
- cada código puede usarse una sola vez por evento,
- el comité importa estudiantes por CSV o Excel,
- el usuario registra asistentes,
- el usuario reporta un pago externo,
- el comité aprueba o rechaza ese pago,
- el evento administra política de tratamiento de datos y términos y condiciones,
- el comprador debe aceptar ambos documentos antes de confirmar la reserva,
- solo después de `APPROVED` se habilita el mapa,
- la reserva se hace por cupos en una o varias mesas,
- los asistentes se pueden editar hasta 20 días antes del evento,
- los códigos de reserva son secuenciales por asistente dentro del evento,
- no existe `Seat`,
- no existe `HOLD`,
- no existe flujo principal de checkout o webhook de pago dentro de la aplicación.

Entrega la respuesta en 1 archivo Markdown `.md` con este formato:

1. Mapa de módulos del sistema
2. Requerimientos funcionales por módulo
3. Requerimientos no funcionales
4. Casos de uso detallados
5. Historias de usuario priorizadas
6. Criterios de aceptación
7. Dependencias entre funcionalidades
8. Recomendación de MVP vs versión posterior

Para cada caso de uso incluye:

- nombre,
- objetivo,
- actores,
- precondiciones,
- flujo principal,
- flujos alternos,
- postcondiciones,
- reglas de negocio relacionadas.

Incluye al menos estos módulos si aplican:

- importación de estudiantes,
- autenticación por código,
- administración de salones,
- configuración de layout,
- parametrización de mesas,
- gestión de eventos,
- gestión de asistentes/grupos,
- pagos/validación,
- bandeja del comité,
- reserva de cupos por mesa,
- visualización del mapa del evento,
- operación del organizador,
- reportes/auditoría.

Organiza la salida en tablas donde sea útil y evita terminología heredada del modelo anterior.