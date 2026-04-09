# Auditoría y Análisis de Brechas del MVP — Aplicación de Reserva de Mesas para Eventos

**Documento elaborado de forma colegiada por el Equipo Auditor Experto:**
*Product Manager Senior, Analista de Negocio Senior, Arquitecto de Software Senior, Arquitecto de Datos Senior, UX Designer Senior y Technical Lead Senior.*

---

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


---

## 1. Resumen Ejecutivo de la Auditoría

Tras revisar minuciosamente la arquitectura, flujos de UX, modelo de datos y reglas de negocio previamente modeladas (Documentos 1 al 10), contrastados con los **nuevos requerimientos detallados en el contexto del negocio**, el equipo auditor determina que la solución, tal como estaba planteada en su documentación previa, **actualmente presenta desviaciones significativas (gaps)** frente al comportamiento esperado en esta nueva iteración. 

Sin embargo, aplicando las acciones correctivas propuestas en este documento, **el MVP es técnica y lógicamente altamente viable**, y, de hecho, las recientes restricciones simplifican algunos de los problemas técnicos más complejos (por ejemplo, el abandono del _Hold_ temporal efímero en pro de créditos pre-aprobados, y la eliminación de la reserva individual de la silla).

En esta auditoría garantizamos una plataforma limpia, unificada y optimizada tanto para los comités organizadores (administradores) como para los estudiantes/grupos familiares.

---

## 2. Análisis de Brecha (Gap Analysis) e Impactos Funcionales

Hemos detectado 6 brechas fundamentales entre el paradigma interior del diseño inicial y las directrices y reglas exactas que el MVP actual demanda. A continuación, el comité experto propone la definición concreta a las ambigüedades identificadas:

### BRECHA 1: Inversión en el Ciclo Transaccional (Selección vs. Pago)
* **Lo que la documentación previa asumía:** El comprador navegaba por el mapa, seleccionaba sillas (creando un estado "HOLD" temporal congelado con un cronómetro), pagaba en una pasarela/externo, y se le confirmaba la silla automáticamente (o la perdía si se pasaba de la expiración).
* **Regla de negocio actual:** `"El usuario ingresa -> Registra asistentes -> Sube comprobante de pago informando nº de boletas compradas -> Comité aprueba -> Solo si es aprobado, escoge mesa y sistema asigna cupos"`. 
* **Definición y Mitigación propuesta (Business Analytics & Arquitectura):**
  * **Se elimina la pre-reserva (HOLD) temporal del inventario limitante del mapa.** 
  * El nuevo flujo es un modelo basado en **"Habilitaciones de Crédito"**. El estudiante no puede interactuar con el mapa geográficamente (bloqueado) hasta no tener un estado de pago `APROBADO` revisado por el organizador. 
  * Una vez la cuenta pasa a estado verificado, se desbloquea el mapa y la asignación se realiza como una reserva definitiva con un **Token de Cupo**. Esto estabiliza el mapa increíblemente dado que no habrá inventarios intermedios a punto de expirar en bases de datos.

### BRECHA 2: La Unidad Atómica de Inventario (Silla específica vs Número de Cupos en Mesa)
* **Lo que la documentación previa asumía:** Selección individualizada (e.g. "Selecciona la silla 2 de la mesa 12"). Esto implicó crear la entidad `Seat`.
* **Regla de negocio actual:** `"El usuario no escoge silla específica... Cada mesa tiene 10 puestos... Solo reserva una cantidad de puestos dentro de una mesa. Si reserva 3 puestos, la mesa queda en 7"`.
* **Definición y Mitigación propuesta (Data Architecture & Tech Lead):**
  * **Deprecated `Seat` Entity en Base de Datos.**
  * A nivel computacional y lógico es un gran alivio. El MVP solo controlará contadores atómicos incrementales/decrementales por Mesa (es decir: `LayoutTable` tendrá `capacity: 10` y contadores `occupied_spots_count`), y las reservas serán transacciones de cupos vinculados a la `LayoutTableId`. No se dibujarán sillas seleccionables, se dibujarán las Mesas con un indicador global e.g., (Mesa B: 7/10 disponibles). Cuando un usuario selecciona una mesa, dirá "¿Cuántos de sus N cupos quiere ubicar aquí?".

### BRECHA 3: El Workflow de Conciliación de Pagos y Carga de Evidencia
* **Lo que la documentación previa asumía:** Pasarelas de pagos asíncronos vía Webhooks (Stripe, Mercado Pago).
* **Regla de negocio actual:** `"El pago se realiza por fuera de la aplicación. Usuario registra compra, sube evidencia, puede editar o eliminar su registro hasta que le aprueban. El comité organizador valida el pago: aprobado o rechazado."` Y dos modos, Digital (vía UI del usuario) o Efectivo (víaUI del comité).
* **Definición y Mitigación propuesta (UX Design & Tech Lead):** 
  * Se requiere la creación de un nuevo submódulo operativo: **Bandeja de Conciliación Manual (Inbox de Pagos)**.
  * Cambios persistentes de estatus en objeto `Payment` (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`).
  * Hay que implementar un **Upload Manager** (Storage Service) para archivos JPG/PNG/PDF.

### BRECHA 4: Data Gathering de Participantes en Eventos (Formularios)
* **Lo que la documentación previa asumía:** `Participant` solo contenía variables genéricas (nombres, email).
* **Regla de negocio actual:** Obligación normativa de recabar: `Nombres`, `Apellidos`, `Cédula`, `Vegetariano (booleano)`, `Alergias (string/texto libre)`.
* **Definición y Mitigación propuesta (Data Architecture):** 
  * Ampliación de la entidad `Participant` para que concuerde con el compliance nutricional y de seguridad del salón. Estos datos se vincularán al registro previo del comprobante para indicar por cuántas personas paga exacto el estudiante.

### BRECHA 5: El Autenticador mediante Cargue de Dataset CSV as Code
* **Lo que la documentación previa asumía:** Identity Pool / Auth Provider o Magic Link.
* **Regla de negocio actual:** `"Administrador realiza cargue masivo (CSV/Excel) de estudiantes con un código único. El estudiante ingresa usando ese código"`.
* **Definición y Mitigación propuesta (Software Architect):** 
  * Autenticación basada en "Validación de Código". El endpoint `/auth/login` ahora consumirá `codigo_estudiante` contra el pre-cargue realizado por el comité en pantalla de importación.
  * Es indispensable un módulo CRUD (Crear, Leer) que acepte procesadores CSV y mapee `Código Único` (Primary key externa).

### BRECHA 6: Límites Constreñidos por Etapas Temporales "Hardcoded"
* **Lo que la documentación previa asumía:** Límites configurados genéricamente, abstractos.
* **Regla de negocio actual:** En Preventa máximo 4 boletas. En Venta General máximo 3.
* **Definición y Mitigación propuesta (Business Analytics):**
  * La entidad de Configuración de Evento deberá contener atributos concretos de cronología contra cantidades máximas:
    * `presale_start_date`, `presale_end_date` -> `max_presale_tickets: 4`.
    * `sale_start_date`, `sale_end_date` -> `max_sale_tickets: 3`.
  * La API validará transaccionalmente la fecha `NOW()` frente a los atributos para prohibir que un usuario indique "5" boletas con evidencia, fallando temprano (Usabilidad de error predictivo).

---

## 3. Rediseño Colegiado por Disciplina para el MVP 

Como comité garantizador, declaramos las pautas específicas para guiar la implementación y corregir las desviaciones.

### 💼 Perspectiva del Product Manager & Business Analyst (Operatividad)
* **Módulo Mínimo Viable (Scope cerrado):** 
  1. Login mediante Código.
  2. Perfil con registro de N asistentes (Nº condicionado a etapa: Máx 4 en preventa, 3 en venta).
  3. Módulo de Carga de Pagos con status tracking.
  4. Módulo In-app del Organizador `(Approval Inbox)`.
  5. Asignación Definitiva en Mapa (Solo habilitada para estados de pago `APPROVED`).
* **Código de Reserva generado:** Una vez agrupados asistentes con sus cupos a la Mesa, el sistema disparará un UUID ufanumérico simple al usuario con: `Mesa Asignada, Cantidad puestos, Estado Vinculado Pago (APROBADO) y Código Estudiante`.

### 🎨 Perspectiva del UX/UI Designer Senior
* **Rediseño Flujo de Usuario Principal (B2C):**
  1. `Pantalla 1:` Ingresa tu código único estudiantil -> `Pantalla 2:` Listado dinámico de participantes (formularios en array expandible según cantidad que diga a comprar).
  2. `Pantalla 3:` Subida de Recibo. Opción a guardar en borrador. Botón rojo: "Enviar para aprobación".
  3. `Pantalla 4:` Estado visual "En revisión del Comité". _UI bloqueada en solo lectura._
  4. `Pantalla 5:` Si llega estatus `Aprobado` vía polling/alerta, habilitación de Botón primario: **"Seleccionar Mesas"**.
  5. `Pantalla 6:` Modalidad point & click en Mesa. Overlay que indica "Has seleccionado la mesa M12: restan asignar X cupos tuyos".
* **Rediseño Mapa del Comité (B2B):** Layout general en verde (disponible) / naranja / rojo (mesa a tope), para visión agregada, ignorando las interacciones a nivel silla.

### 💾 Perspectiva del Arquitecto de Datos
Modificaciones a los esquemas previamente documentados que son **obligatorios** ejecutar de inmediato en la escritura de migraciones de la DB:
* `Participant:` `id, attendee_group_id, fullname, document_id, is_vegetarian (bool), allergies (text)`.
* `Payment:` `id, attendee_group_id, receipt_image_url, payment_type (DIGITAL|CASH), status (DRAFT|PENDING|APPROVED|REJECTED)`.
* `LayoutTable:` `id, layout_id, code, table_capacity_limit (default 10), current_occupied_spots (int)`. *(Se borra la tabla anidada de Seats y SeatOccupation; todo pasa a TableReservations).*
* `TableReservation:` `id, attendee_group_id, layout_table_id, spots_reserved (int), generated_reservation_code`.

### ⚙️ Perspectiva del Arquitecto de Software & Tech Lead
* **Adiós Timer de Holds y Jobs:** Desaparece el Worker para expiraciones de tiempo de mesa. Gana enorme estabilidad el backend. No hay "carreras" contrarreloj. Todo es asincrónico guiado por humanos (Comité).
* **Estrategia de Concurrencia (DB Lock):**
  * Las peticiones de asignación a mesas se tratarán atómicamente empleando Transacciones ACID combinadas con **Pessimistic Locking (SELECT ... FOR UPDATE)** sobre el registro `LayoutTable`.
  * *Pesudocódigo de transacción de selección actual:*
    ```sql
    BEGIN;
    SELECT table_capacity_limit, current_occupied_spots 
    FROM layout_tables WHERE id = 'uuid-mesa' FOR UPDATE;
    
    -- Si la mesa(10) - ocupados(7) < lo que quiere reservar(4) = FALLA 409 CONFLICT
    -- De lo contrario, UPDATE layout_tables SET current_occupied_spots += 4
    
    INSERT INTO table_reservations (...)
    COMMIT;
    ```
* **Storage y Files:** Integración S3 / Azure Blobs obligatoria para que el BackEnd genere "Pre-signed URLs" al front y guarden las fotos/comprobantes de los pagos seguros y ajenos al espacio del application server. 

---

## 4. Conclusión Final y Dictamen de Viabilidad

Evaluadas las directrices, concluye la junta auditora:
**El sistema MVP resulta TOTALMENTE VIABLE, LÓGICO Y COHERENTE.** 

Las nuevas premisas dictadas simplifican un sistema originalmente agobiado por condiciones de carrera (holds de tiempos cortos interrumpiéndose) hacia un sistema con control humano del ciclo "Financiero" (`Comprobación de Recibo`) y un paso final expedito y certero "Espacial/Reservas" (`Asignar a Mesa`).

El planteamiento final minimiza los errores de usuarios compitiendo de manera frenética, delega la validación de fraude o concurrencia pesada al tiempo de latencia donde el organizador es quien aprueba con calma que el monto recibido en banco coincida con la evidencia, para que por último cada familia simplemente vaya colocando sus X personas en mesas amplias.

**Este documento establece la línea base conceptual definitiva**. Ningún desarrollo arquitectónico debe usar asunciones del historial 1 al 10 en torno a la Silla (`Seat`) y en su lugar empleará el enfoque de `Capacidad de Mesa (`LayoutTable`)`, priorizando el registro previo y la carga de comprobantes en el Flujo Cero del negocio.
