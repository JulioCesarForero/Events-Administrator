Actúa como un Arquitecto de Datos y Software senior experto en dominios transaccionales, conciliación manual de pagos y reserva de cupos por mesa.

Necesito diseñar el modelo de datos de una aplicación para administrar estudiantes, asistentes, pagos externos, mesas y reservas definitivas de cupos en eventos.

Contexto funcional:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`

Objetivo:
Diseñar un modelo de datos lógico y conceptual que soporte el MVP real.

La propuesta debe asumir explícitamente que:

- la autenticación del comprador es por `codigo_estudiante`,
- cada código puede usarse una sola vez por evento,
- existe importación masiva de estudiantes,
- cada asistente tiene datos obligatorios,
- los asistentes se pueden editar por compradores hasta 20 días antes del evento,
- el pago se hace fuera de la aplicación,
- el evento administra política de tratamiento de datos y términos y condiciones propios,
- la reserva exige aceptación explícita de ambos documentos,
- el pago tiene estados `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`,
- solo con pago aprobado se habilita la reserva,
- la reserva es por cupos en una o varias mesas,
- se deben asignar códigos correlativos por asistente dentro del evento,
- cada mesa tiene 10 cupos en la línea base actual,
- no existe entidad `Seat`,
- no existe `HOLD`,
- no existe bloqueo temporal del inventario como parte del MVP base.

Entrega:

1. Entidades principales
2. Descripción de cada entidad
3. Atributos sugeridos por entidad
4. Relaciones entre entidades
5. Cardinalidades
6. Llaves primarias y foráneas sugeridas
7. Reglas de integridad
8. Eventos de auditoría recomendados
9. Riesgos de consistencia
10. Propuesta de modelo relacional inicial

Incluye, si corresponde:

- Venue o salón
- Layout del salón
- Zona
- Mesa
- Evento
- Configuración del evento
- Estudiante importado
- Grupo comprador o grupo de asistentes
- Participante
- Pago
- Reserva de cupos en mesa
- Estado de disponibilidad por mesa
- Política de tratamiento de datos del evento
- Términos y condiciones del evento
- Registro de aceptación legal
- Usuario organizador
- Historial de cambios

Incluye además:

- un diagrama entidad-relación en Mermaid,
- una explicación de por qué ciertas entidades deben separarse y no mezclarse.

Evita conceptos heredados del modelo anterior y sé riguroso con la trazabilidad entre pago aprobado y reserva final.