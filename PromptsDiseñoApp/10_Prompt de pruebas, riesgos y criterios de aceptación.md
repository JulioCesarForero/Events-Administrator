Actúa como un QA Lead y Arquitecto de Calidad senior experto en sistemas transaccionales y validación de reglas complejas.

A partir de esta definición de producto y solución:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\4.Modelo_de_datos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\6.Motor_layout_y_asignacion_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\7.Arquitectura_tecnica_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\8.APIs_y_contratos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\9.Plan_desarrollo_MVP_gestion_ubicaciones_eventos.md`

Objetivo:
Definir la estrategia de calidad y pruebas para el MVP real.

La respuesta debe asumir que:

- el acceso comprador es por código,
- cada código se usa una sola vez por evento,
- el pago se registra fuera de la aplicación,
- la revisión del pago es manual,
- el evento administra política de tratamiento de datos y términos y condiciones,
- la reserva exige aceptación explícita de ambos documentos,
- la reserva es por cupos en una o varias mesas,
- la edición de participantes del comprador se permite hasta 20 días antes del evento,
- los códigos de reserva son correlativos por asistente,
- no existe `Seat`,
- no existe `HOLD`,
- la concurrencia crítica está en la reserva de una mesa,
- la visualización del layout es por mesas y capacidad agregada.

Entrega la respuesta en 1 archivo Markdown `.md` con el siguiente formato:

1. Riesgos funcionales críticos
2. Riesgos técnicos críticos
3. Escenarios de prueba prioritarios
4. Casos de prueba funcionales
5. Casos de prueba de concurrencia
6. Casos de prueba de seguridad
7. Casos de prueba de usabilidad
8. Casos de prueba de auditoría y trazabilidad
9. Criterios de aceptación por módulo
10. Recomendaciones para automatización de pruebas

Enfatiza especialmente:

- doble asignación de una misma mesa,
- cambio o movimiento de reserva,
- pago pendiente vs pago aprobado,
- intervención del organizador,
- grupos que exceden la capacidad,
- modificaciones de último minuto,
- visualización correcta del layout.