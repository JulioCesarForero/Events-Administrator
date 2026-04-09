Actúa como un Arquitecto de Software senior con experiencia en motores de asignación, modelado espacial 2D y sistemas transaccionales de reserva por capacidad agregada.

Necesito que diseñes conceptualmente el motor de configuración del salón y asignación de cupos para una aplicación de gestión de eventos.

Contexto:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\4.Modelo_de_datos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md`

Objetivo:
Definir cómo debe funcionar el motor de layout y asignación del MVP.

La respuesta debe asumir que:

- el inventario se controla por mesa y cupos disponibles,
- no se selecciona silla individual,
- no existe `HOLD`,
- no existe bloqueo temporal del inventario,
- la asignación final ocurre solo tras pago `APPROVED`,
- la asignación final exige aceptación previa de política de datos y términos del evento,
- una sola operación puede repartir cupos en varias mesas,
- deben emitirse códigos correlativos por asistente,
- la concurrencia debe resolverse con consistencia fuerte sobre la mesa.

Entrega la respuesta en 1 archivo Markdown `.md`.

Analiza y propone:

1. Modelo conceptual del layout del salón
2. Cómo representar:
   - dimensiones del salón,
   - zonas,
   - tarima,
   - pista de baile,
   - mesas,
   - capacidad por mesa,
   - rotación, posición y coordenadas,
   - restricciones de circulación o áreas no utilizables
3. Estrategias para crear el layout
4. Cómo manejar disponibilidad por mesa
5. Reglas de asignación por grupo
6. Cómo evitar inconsistencias por concurrencia
7. Estrategia de bloqueo transaccional
8. Estrategia de liberación y reasignación
9. Recomendación de algoritmo o enfoque técnico para validar capacidad y ocupación
10. Qué decisiones deben vivir en backend y cuáles en frontend
11. Riesgos técnicos y operativos

Entrega además:

- una propuesta de modelo de objetos para el motor,
- pseudocódigo del proceso de reserva, ajuste y liberación,
- un diagrama Mermaid del proceso.

No uses conceptos del modelo anterior basados en `Seat`, `seat_ids`, `hold_timeout` o confirmación diferida por pasarela.