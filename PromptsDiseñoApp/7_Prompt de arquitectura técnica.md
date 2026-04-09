Actúa como un Arquitecto de Soluciones y Arquitecto de Software senior con experiencia en plataformas web transaccionales, importación de datos, conciliación manual y reservas espaciales.

Necesito proponer la arquitectura técnica para una aplicación de gestión de participantes, pagos externos y reserva de cupos en mesas.

Contexto funcional:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\4.Modelo_de_datos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\6.Motor_layout_y_asignacion_gestion_ubicaciones_eventos.md`

Objetivo:
Diseñar una arquitectura técnica robusta, escalable y mantenible.

La propuesta debe asumir que:

- el comprador accede por código único,
- existe importación de estudiantes,
- el pago se registra fuera de la app y se revisa manualmente,
- el sistema debe almacenar evidencias,
- el sistema debe administrar documentos legales del evento y registrar su aceptación,
- solo después del pago aprobado se puede reservar,
- la concurrencia se da a nivel de mesa o conjunto de mesas en una sola operación,
- deben emitirse códigos secuenciales por asistente,
- no existe `Seat`,
- no existe `HOLD`,
- no se requiere un worker de expiración de inventario temporal para el MVP.

Entrega la respuesta en 1 archivo Markdown `.md` con el siguiente formato:

1. Propuesta de arquitectura de alto nivel
2. Componentes principales
3. Responsabilidad de cada componente
4. Propuesta de frontend
5. Propuesta de backend
6. Base de datos recomendada
7. Mecanismo de autenticación y autorización
8. Módulo de pagos y validación manual
9. Estrategia de concurrencia y consistencia
10. Auditoría y trazabilidad
11. Estrategia de notificaciones
12. Observabilidad y monitoreo
13. Riesgos técnicos
14. Recomendación para MVP
15. Roadmap técnico evolutivo

Incluye:

- diagrama de arquitectura en Mermaid,
- justificación de decisiones,
- trade-offs,
- sugerencia de stack tecnológico,
- criterios para decidir entre monolito modular o microservicios.

Prioriza simplicidad, mantenibilidad y tiempo de salida a mercado para un MVP coherente con la auditoría.