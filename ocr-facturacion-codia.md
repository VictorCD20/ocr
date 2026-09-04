# Modulo OCR de facturacion - CODIA

## Objetivo

Crear un primer modulo para que una persona pueda tomar foto de tickets o facturas desde su celular, extraer los datos importantes y enviarlos a un panel donde se puedan revisar, corregir y aprobar.

Este modulo no reemplaza Loyverse ni Soft Restaurant. Funciona como una capa de orden y verificacion para reducir captura manual, centralizar comprobantes y preparar informacion util para reportes, facturacion y pre-nomina.

## Problema identificado

La clienta puede tener informacion repartida entre tickets, facturas, fotos, correo, WhatsApp, Loyverse y posiblemente Soft Restaurant. El trabajo manual aparece en tres puntos:

- Leer tickets o facturas para capturar datos.
- Revisar si cada empleado entrego lo que tenia que entregar.
- Preparar informacion confiable para reportes, pagos o revision administrativa.

## Alcance MVP

El primer MVP debe validar solo lo indispensable:

1. Captura de imagen desde celular.
2. Extraccion automatica de datos.
3. Revision manual antes de aprobar.
4. Guardado historico por empleado, fecha y estado.
5. Notificacion basica cuando un documento queda pendiente o rechazado.

## Tipos de documentos

Prioridad inicial:

- Ticket de compra.
- Representacion impresa de factura CFDI.
- Comprobante con codigo QR.

Fuera del primer MVP:

- Declaraciones fiscales.
- Calculo fiscal definitivo.
- Timbrado de facturas.
- Integracion directa con SAT o PAC sin validacion tecnica previa.

## Datos a extraer

Datos generales:

- Tipo de documento: ticket, factura, comprobante no identificado.
- Fecha.
- Hora, si aparece.
- Proveedor o emisor.
- RFC emisor, si aparece.
- RFC receptor, si aparece.
- Folio o UUID, si aparece.
- Total.
- Subtotal, si aparece.
- IVA/impuestos, si aparecen.
- Metodo o forma de pago, si aparece.
- Conceptos principales.
- Moneda, normalmente MXN.

Datos operativos:

- Empleado que subio el documento.
- Sucursal o negocio.
- Categoria: gasto, venta, insumo, nomina, otro.
- Estado: pendiente, leido, requiere revision, aprobado, rechazado.
- Comentarios de revision.

## Flujo propuesto

1. El empleado entra desde una liga o app web.
2. Toma foto o sube imagen del comprobante.
3. El sistema procesa la imagen.
4. El sistema muestra los datos detectados con nivel de confianza.
5. El empleado confirma o corrige.
6. La encargada revisa desde el panel.
7. La encargada aprueba, rechaza o pide correccion.
8. El sistema guarda historial y genera reporte por periodo.

## Reglas de validacion

El sistema debe marcar como "requiere revision" cuando:

- No detecta total.
- No detecta fecha.
- El total parece inconsistente con subtotal e impuestos.
- El RFC detectado no tiene formato valido.
- La foto esta borrosa, cortada o con baja iluminacion.
- Hay mas de un posible total.
- El documento ya fue subido antes.

## Panel administrativo

Vistas necesarias:

- Bandeja de documentos pendientes.
- Documentos por empleado.
- Documentos por periodo.
- Documentos rechazados.
- Reporte de totales por semana/mes.
- Configuracion de empleados.
- Configuracion de categorias.

Acciones necesarias:

- Aprobar documento.
- Rechazar documento.
- Editar campos extraidos.
- Agregar comentario.
- Exportar CSV/Excel.
- Ver imagen original.

## Integracion posterior con Loyverse

La integracion con Loyverse debe entrar despues del OCR basico. Primero se valida que la captura y revision realmente le ahorra tiempo a la clienta.

Posibles usos de Loyverse:

- Obtener empleados.
- Obtener ventas o recibos.
- Obtener turnos/cierres de caja.
- Cruzar ventas por empleado contra documentos subidos.
- Generar reportes por semana o mes.

Permisos que probablemente se tendrian que revisar:

- Lectura de empleados.
- Lectura de recibos.
- Lectura de turnos.
- Lectura de tiendas/sucursales.

## Maquina/verificador

El verificador debe funcionar como una lista de control:

- Quien subio documento.
- Quien no subio.
- Que documentos pasaron.
- Que documentos fallaron.
- Que documentos requieren revision.
- Que totales entran al reporte.
- Que empleados tienen pendientes.

En una segunda etapa puede conectarse con pre-nomina:

- Horas trabajadas.
- Dias trabajados.
- Ventas por empleado.
- Bonos o comisiones, si aplican.
- Descuentos o ajustes manuales.

Esto debe manejarse como pre-nomina revisable, no como nomina fiscal definitiva.

## Prueba tecnica inicial

Para probar el modulo se necesitan de 20 a 30 imagenes reales o simuladas:

- 10 tickets claros.
- 5 tickets borrosos o cortados.
- 5 facturas impresas con QR.
- 5 comprobantes variados.
- 5 casos repetidos o con errores.

Medicion de la prueba:

- Porcentaje de documentos leidos correctamente.
- Campos que fallan con mas frecuencia.
- Tiempo promedio antes/despues.
- Casos que requieren revision humana.
- Si la encargada entiende y confia en el flujo.

## Entregable demo

Demo recomendable para venta:

- Pantalla movil para subir foto.
- Panel con documentos procesados.
- Estados de revision.
- Vista de detalle con imagen + datos extraidos.
- Reporte semanal simple.

Mensaje comercial:

"CODIA ayuda a ordenar tus comprobantes y reducir captura manual: tomas una foto, el sistema extrae los datos importantes y tu equipo solo revisa lo necesario."

## Pendientes para diagnostico

Preguntas para la clienta:

- Que documentos captura actualmente y con que frecuencia.
- Quien toma las fotos o captura los datos.
- Quien revisa/aprueba.
- Que datos le importan para facturar.
- Que datos le importan para nomina.
- Si ya tiene cuenta activa de Loyverse.
- Si usa Soft Restaurant actualmente o solo lo toma como referencia.
- Si necesita correos, WhatsApp o ambos.
- Si maneja una o varias sucursales.
- Que reporte semanal quiere ver exactamente.

## Decision recomendada

Avanzar primero con OCR + panel de revision, sin prometer integracion completa con Loyverse ni automatizacion fiscal. La primera meta es demostrar que CODIA puede convertir fotos de comprobantes en informacion ordenada, revisable y util para decisiones administrativas.
