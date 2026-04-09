Actúa como un Product Designer senior y UX Architect especializado en flujos B2B/B2C, conciliación manual y experiencias de reserva espacial para eventos.

Con base en:

- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\1.Definicion_producto_gestion_ubicaciones_eventos.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\2.Catalogo_reglas_de_negocio_gestion_ubicaciones.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\3.Casos_de_uso_y_requerimientos_funcionales.md`
- `C:\ProyectosIA\Events-Administrator\PromptsDiseñoApp\4.Modelo_de_datos_gestion_ubicaciones_eventos.md`

Objetivo:
Diseñar la experiencia de usuario y los flujos principales de la aplicación para dos perfiles:

1. Organizador o administrador
2. Estudiante o comprador autorizado

La propuesta debe asumir obligatoriamente que:

- el usuario entra con código único,
- cada código puede usarse una sola vez por evento,
- primero registra asistentes,
- después registra el pago externo,
- el comité aprueba o rechaza,
- el evento administra política de tratamiento de datos y términos y condiciones,
- el comprador debe aceptar ambos documentos antes de confirmar la reserva,
- solo después se habilita el mapa,
- la reserva es por cupos en una o varias mesas,
- la edición de asistentes se cierra para el comprador 20 días antes del evento,
- los códigos de reserva son secuenciales por asistente,
- no existe selección de silla individual,
- no existe `HOLD`,
- no existe checkout dentro de la aplicación como flujo principal.

Entrega la respuesta en 1 archivo Markdown `.md` con el siguiente formato:

1. Arquitectura de información
2. Mapa de pantallas
3. Flujos principales por actor
4. Flujo de registro de asistentes
5. Flujo de pago y revisión del comité
6. Flujo de reserva de cupos en mesa
7. Flujo de intervención manual del organizador
8. Estados de UI para disponibilidad, bloqueo, pendiente, aprobado, rechazado, reservado y restringido
9. Recomendaciones de usabilidad
10. Riesgos UX críticos
11. Otros flujos detectados

Incluye:

- wireframes descritos en texto,
- componentes UI sugeridos,
- comportamiento responsive web,
- reglas visuales para representar mesas, tarima, pista, zonas y cupos.

Genera también diagramas Mermaid para los flujos más importantes y evita terminología heredada del diseño anterior.