Actúa como un Arquitecto Backend senior y diseñador de APIs REST/JSON.

Con base en esta solución:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\4.Modelo_de_datos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\5.UX_UI_y_flujos_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\6.Motor_layout_y_asignacion_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\7.Arquitectura_tecnica_gestion_ubicaciones_eventos.md`

Objetivo:
Definir los contratos API iniciales necesarios para construir el MVP real.

La API debe asumir explícitamente que:

- el comprador entra con `codigo_estudiante`,
- cada código de estudiante puede usarse una sola vez por evento,
- el administrador importa estudiantes por CSV o Excel,
- el usuario registra asistentes,
- el usuario registra un pago externo,
- el comité aprueba o rechaza ese pago,
- el evento administra política de tratamiento de datos y términos y condiciones,
- el comprador debe aceptar ambos documentos antes de confirmar la reserva,
- solo después de `APPROVED` el mapa se habilita,
- la reserva es por cupos en una o varias mesas,
- los participantes se editan por compradores solo hasta 20 días antes del evento,
- los códigos de reserva son secuenciales por asistente,
- no existe `Seat`,
- no existe `HOLD`,
- no existe `webhook` de pasarela como eje principal del flujo,
- sí puede existir integración futura o auxiliar, pero el contrato principal es de conciliación manual.

Entrega en un archivo Markdown unificado `.md` los siguientes elementos:

1. Catálogo de endpoints
2. Método HTTP
3. Propósito de cada endpoint
4. Request/Response sugeridos
5. Códigos de error
6. Reglas de validación
7. Consideraciones de seguridad
8. Reglas de idempotencia si aplican
9. Endpoints de auditoría o historial
10. Recomendaciones para versionamiento

Incluye endpoints para:

- autenticación por código,
- gestión de salones,
- layouts,
- mesas,
- eventos,
- importación de estudiantes,
- asistentes y grupos,
- pagos y revisión del comité,
- visualización del mapa,
- reserva de cupos,
- liberación o cambio de ubicación,
- operaciones del organizador,
- auditoría e historial.

Entrega también ejemplos JSON y evita terminología del diseño anterior.