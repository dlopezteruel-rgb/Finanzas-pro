import {pluralCategory,languages,type Language,type translate} from './messages';
import {domainOwnedText} from './domainMessages';
import {presentationMoney,type presentationFormatters} from './presentation';
import type {FinanceData} from '../utils/backup';
import type {DeletionReport,DeletionTarget} from '../utils/deletion';

/** Owned diagnostics and dependency labels only. Never apply to personal fields or saved history. */
const keys={
  "No se ha guardado el movimiento.": "assistant.saveFailed",
  "debe ser un objeto.": "storage_message.debe_ser_un_objeto",
  "falta este campo.": "storage_message.falta_este_campo",
  "campo no reconocido.": "storage_message.campo_no_reconocido",
  "debe ser un texto válido.": "storage_message.debe_ser_un_texto_valido",
  "debe ser true o false.": "storage_message.debe_ser_true_o_false",
  "debe ser una fecha real con formato AAAA-MM-DD.": "storage_message.debe_ser_una_fecha_real_con_formato_aaaa_mm_dd",
  "debe ser GASTO o INGRESO.": "storage_message.debe_ser_gasto_o_ingreso",
  "debe ser una lista.": "storage_message.debe_ser_una_lista",
  "contiene identificadores duplicados.": "storage_message.contiene_identificadores_duplicados",
  "fecha de aprobación inválida.": "storage_message.fecha_de_aprobacion_invalida",
  "línea monetaria inválida.": "storage_message.linea_monetaria_invalida",
  "totales inconsistentes con la fotografía.": "storage_message.totales_inconsistentes_con_la_fotografia",
  "base + arrastre no coincide con la fotografía efectiva.": "storage_message.base_arrastre_no_coincide_con_la_fotografia_efectiva",
  "versión no compatible. Se admiten los formatos 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3 y 3.4; no se ha modificado ningún dato.": "storage_message.version_no_compatible_se_admiten_los_formatos_2_5_2_6_2",
  "fecha de exportación inválida.": "storage_message.fecha_de_exportacion_invalida",
  "debe ser dark o light.": "storage_message.debe_ser_dark_o_light",
  "modelo no compatible.": "storage_message.modelo_no_compatible",
  "tipo de liquidación inválido.": "storage_message.tipo_de_liquidacion_invalido",
  "periodo inválido; usa AAAA-MM.": "storage_message.periodo_invalido_usa_aaaa_mm",
  "no coincide con el tipo del paquete.": "storage_message.no_coincide_con_el_tipo_del_paquete",
  "debe ser una lista de textos.": "storage_message.debe_ser_una_lista_de_textos",
  "tipo de cartera inválido.": "storage_message.tipo_de_cartera_invalido",
  "3.2 requiere la preferencia (ID o null).": "storage_message.3_2_requiere_la_preferencia_id_o_null",
  "la cartera no existe.": "storage_message.la_cartera_no_existe",
  "2.9 requiere metadatos mensuales no vacíos.": "storage_message.2_9_requiere_metadatos_mensuales_no_vacios",
  "la distribución aprobada vigente no coincide con la previsión actual.": "storage_message.la_distribucion_aprobada_vigente_no_coincide_con_la_prevision_actual",
  "la aprobación no puede superar la revisión actual.": "storage_message.la_aprobacion_no_puede_superar_la_revision_actual",
  "la aprobación vigente no coincide con la previsión actual.": "storage_message.la_aprobacion_vigente_no_coincide_con_la_prevision_actual",
  "La aprobación debe distinguir base y arrastre vigente.": "storage_message.la_aprobacion_debe_distinguir_base_y_arrastre_vigente",
  "3.3 requiere el registro de identidades y previsiones mensuales.": "storage_message.3_3_requiere_el_registro_de_identidades_y_previsiones_mensuales",
  "3.1 requiere el registro de metadatos nuevo.": "storage_message.3_1_requiere_el_registro_de_metadatos_nuevo",
  "El archivo supera el límite de 10 MB.": "storage_message.el_archivo_supera_el_limite_de_10_mb",
  "El archivo no contiene un JSON válido.": "storage_message.el_archivo_no_contiene_un_json_valido",
  "JSON 3.4: catálogo personalizable, archivo e identidades retiradas. Para volver a una versión anterior restaura la copia recuperable completa previa.": "storage_message.json_3_4_catalogo_personalizable_archivo_e_identidades_retiradas_para_volver_a",
  "JSON 3.3: subítems, previsiones mensuales y fotografías. Las versiones anteriores no lo leen: conserva la copia recuperable completa previa.": "storage_message.json_3_3_subitems_previsiones_mensuales_y_fotografias_las_versiones_anteriores_no",
  "JSON 3.2: incluye la cartera predeterminada por ID. Para volver a una versión anterior utiliza la copia recuperable completa previa.": "storage_message.json_3_2_incluye_la_cartera_predeterminada_por_id_para_volver_a",
  "JSON 3.1: reglas, ocurrencias y compromisos. Para volver a una versión anterior restaura la copia recuperable previa completa.": "storage_message.json_3_1_reglas_ocurrencias_y_compromisos_para_volver_a_una_version",
  "JSON 3.0: contiene automatización e historial. Las versiones antiguas no lo leen; utiliza la copia recuperable completa previa para volver atrás.": "storage_message.json_3_0_contiene_automatizacion_e_historial_las_versiones_antiguas_no_lo",
  "JSON 2.9: incluye objetivos y últimas aprobaciones mensuales. Las versiones anteriores de la aplicación no pueden leerlo; utiliza la copia recuperable anterior para volver atrás.": "storage_message.json_2_9_incluye_objetivos_y_ultimas_aprobaciones_mensuales_las_versiones_anteriores",
  "Gastos compartidos históricos sin migrar: conservan el gasto total y el tratamiento anterior de ingresos. Revisa la migración para aplicar la parte propia y excluir los reintegros confirmados.": "storage_message.gastos_compartidos_historicos_sin_migrar_conservan_el_gasto_total_y_el_tratamiento",
  "Hay movimientos o presupuestos con partidas que no figuran en el catálogo. Se conservarán sin cambiar sus cálculos.": "storage_message.hay_movimientos_o_presupuestos_con_partidas_que_no_figuran_en_el_catalogo",
  "Hay referencias a carteras que no existen en esta copia.": "storage_message.hay_referencias_a_carteras_que_no_existen_en_esta_copia",
  "Hay movimientos vinculados a préstamos que no existen en esta copia.": "storage_message.hay_movimientos_vinculados_a_prestamos_que_no_existen_en_esta_copia",
  "Hay participantes o reintegros sin su referencia correspondiente.": "storage_message.hay_participantes_o_reintegros_sin_su_referencia_correspondiente",
  "Otra pestaña ha cambiado los datos. No se ha guardado esta operación. Recarga para trabajar con la última versión.": "storage_message.otra_pestana_ha_cambiado_los_datos_no_se_ha_guardado_esta_operacion",
  "Revisión local inválida.": "storage_message.revision_local_invalida",
  "No se pudo verificar la copia de recuperación.": "storage_message.no_se_pudo_verificar_la_copia_de_recuperacion",
  "No hay espacio disponible en el almacenamiento del navegador. Los datos anteriores se conservan.": "storage_message.no_hay_espacio_disponible_en_el_almacenamiento_del_navegador_los_datos_anteriores",
  "El navegador o el contenedor no permite acceder al almacenamiento o a Web Locks. Comprueba los permisos y utiliza HTTPS.": "storage_message.el_navegador_o_el_contenedor_no_permite_acceder_al_almacenamiento_o_a",
  "No se pudo guardar. Los datos anteriores se conservan.": "storage_message.no_se_pudo_guardar_los_datos_anteriores_se_conservan",
  "El guardado requiere un contexto seguro: abre la aplicación mediante HTTPS o localhost.": "storage_message.el_guardado_requiere_un_contexto_seguro_abre_la_aplicacion_mediante_https_o",
  "Este navegador o contenedor no ofrece Web Locks. El guardado está bloqueado para evitar sobrescrituras; utiliza un navegador actualizado compatible.": "storage_message.este_navegador_o_contenedor_no_ofrece_web_locks_el_guardado_esta_bloqueado",
  "Los movimientos tienen ocurrencias o liquidaciones personales. Revisa también el borrado de deudas para eliminar todos los vínculos juntos.": "storage_message.los_movimientos_tienen_ocurrencias_o_liquidaciones_personales_revisa_tambien_el_borrado_de",
  "Los compromisos tienen movimientos bancarios. Selecciona también borrar movimientos.": "storage_message.los_compromisos_tienen_movimientos_bancarios_selecciona_tambien_borrar_movimientos",
  "No se pueden borrar carteras conservando sus traspasos. Selecciona también borrar movimientos.": "storage_message.no_se_pueden_borrar_carteras_conservando_sus_traspasos_selecciona_tambien_borrar_movimientos",
  "Para saldar sin movimiento bancario registra una compensación explícita. El borrado completo requiere borrar también los movimientos.": "storage_message.para_saldar_sin_movimiento_bancario_registra_una_compensacion_explicita_el_borrado_completo",
  "El alcance del borrado ha cambiado. Cancela y vuelve a revisar las cantidades antes de confirmar.": "storage_message.el_alcance_del_borrado_ha_cambiado_cancela_y_vuelve_a_revisar_las",
  "Movimientos a eliminar": "storage_message.movimientos_a_eliminar",
  "Transferencias completas incluidas": "storage_message.transferencias_completas_incluidas",
  "Registros históricos de traspaso incluidos": "storage_message.registros_historicos_de_traspaso_incluidos",
  "Registros de traspaso pendientes de revisión": "storage_message.registros_de_traspaso_pendientes_de_revision",
  "Gastos compartidos incluidos": "storage_message.gastos_compartidos_incluidos",
  "Obligaciones del reparto incluidas": "storage_message.obligaciones_del_reparto_incluidas",
  "Liquidaciones y compensaciones incluidas": "storage_message.liquidaciones_y_compensaciones_incluidas",
  "Reintegros incluidos": "storage_message.reintegros_incluidos",
  "Cuotas de préstamos incluidas": "storage_message.cuotas_de_prestamos_incluidas",
  "Cuentas a eliminar": "storage_message.cuentas_a_eliminar",
  "Saldos base a poner a cero": "storage_message.saldos_base_a_poner_a_cero",
  "Desgloses mensuales de subítems a eliminar": "storage_message.desgloses_mensuales_de_subitems_a_eliminar",
  "Planes presupuestarios a eliminar": "storage_message.planes_presupuestarios_a_eliminar",
  "Objetivos y aprobaciones mensuales a eliminar": "storage_message.objetivos_y_aprobaciones_mensuales_a_eliminar",
  "Reglas de planificación a eliminar": "storage_message.reglas_de_planificacion_a_eliminar",
  "Arrastres a eliminar": "storage_message.arrastres_a_eliminar",
  "Fotografías históricas a eliminar": "storage_message.fotografias_historicas_a_eliminar",
  "Procedencias de previsiones a eliminar": "storage_message.procedencias_de_previsiones_a_eliminar",
  "Préstamos a eliminar": "storage_message.prestamos_a_eliminar",
  "Compromisos personales a eliminar": "storage_message.compromisos_personales_a_eliminar",
  "Reglas periódicas e identidades a eliminar": "storage_message.reglas_periodicas_e_identidades_a_eliminar",
  "El borrado dejaría referencias inconsistentes.": "storage_message.el_borrado_dejaria_referencias_inconsistentes",
  "Confirmar borrado seleccionado": "storage_message.confirmar_borrado_seleccionado",
  "Datos seleccionados de todas las fechas": "storage_message.datos_seleccionados_de_todas_las_fechas",
  "Se guardará y verificará una copia recuperable completa antes de aplicar el borrado. Si falla la copia o el guardado, los datos activos se conservan.": "storage_message.se_guardara_y_verificara_una_copia_recuperable_completa_antes_de_aplicar_el",
  "La cartera seleccionada ya no existe.": "storage_message.la_cartera_seleccionada_ya_no_existe",
  "Selecciona una cartera de origen válida. No se ha guardado el movimiento.": "storage_message.selecciona_una_cartera_de_origen_valida_no_se_ha_guardado_el_movimiento",
  "Selecciona una cartera válida para el préstamo.": "storage_message.selecciona_una_cartera_valida_para_el_prestamo",
  "El elemento ya no existe. Cierra esta ventana y revisa los datos actualizados.": "storage_message.el_elemento_ya_no_existe_cierra_esta_ventana_y_revisa_los_datos",
  "Compromisos personales": "storage_message.compromisos_personales",
  "Gastos compartidos": "storage_message.gastos_compartidos",
  "Obligaciones del reparto (incluidas las saldadas)": "storage_message.obligaciones_del_reparto_incluidas_las_saldadas",
  "Liquidaciones y compensaciones": "storage_message.liquidaciones_y_compensaciones",
  "Referencias históricas a reintegros no disponibles": "storage_message.referencias_historicas_a_reintegros_no_disponibles",
  "Reglas periódicas (incluidas las dadas de baja)": "storage_message.reglas_periodicas_incluidas_las_dadas_de_baja",
  "Movimientos vinculados (incluidos los pendientes)": "storage_message.movimientos_vinculados_incluidos_los_pendientes",
  "Liquidaciones con cartera receptora": "storage_message.liquidaciones_con_cartera_receptora",
  "Préstamos con esta cartera habitual": "storage_message.prestamos_con_esta_cartera_habitual",
  "Cuotas y movimientos del préstamo": "storage_message.cuotas_y_movimientos_del_prestamo",
  "Cartera habitual del préstamo": "storage_message.cartera_habitual_del_prestamo",
  "Posibles cuotas históricas por el criterio actual de nombre (requieren revisión)": "storage_message.posibles_cuotas_historicas_por_el_criterio_actual_de_nombre_requieren_revision",
  "El origen periódico se conserva para evitar duplicados. Edita el movimiento o registra una corrección explícita.": "storage_message.el_origen_periodico_se_conserva_para_evitar_duplicados_edita_el_movimiento_o",
  "El movimiento conserva el historial de liquidación de principal. Revísalo desde Deudas.": "storage_message.el_movimiento_conserva_el_historial_de_liquidacion_de_principal_revisalo_desde_deudas",
  "Gastos que referencian este reintegro": "storage_message.gastos_que_referencian_este_reintegro",
  "Liquidaciones del gasto": "storage_message.liquidaciones_del_gasto",
  "El traspaso debe revisarse y eliminarse como una operación completa desde su ventana específica.": "storage_message.el_traspaso_debe_revisarse_y_eliminarse_como_una_operacion_completa_desde_su",
  "El reintegro debe eliminarse desde su liquidación, junto con su registro vinculado.": "storage_message.el_reintegro_debe_eliminarse_desde_su_liquidacion_junto_con_su_registro_vinculado",
  "Revisa y migra el gasto compartido histórico antes de eliminarlo.": "storage_message.revisa_y_migra_el_gasto_compartido_historico_antes_de_eliminarlo",
  "Préstamo de esta cuota": "storage_message.prestamo_de_esta_cuota",
  "Obligaciones incluidas en este gasto": "storage_message.obligaciones_incluidas_en_este_gasto",
  "Eliminar el gasto sin liquidaciones retira también su propio reparto y sus deudas pendientes. No se eliminarán contactos.": "storage_message.eliminar_el_gasto_sin_liquidaciones_retira_tambien_su_propio_reparto_y_sus",
  "la cartera; las carteras vinculadas requieren revisión": "storage_message.la_cartera_las_carteras_vinculadas_requieren_revision",
  "No se puede desvincular un extremo del traspaso.": "storage_message.no_se_puede_desvincular_un_extremo_del_traspaso",
  "Revisa y vincula el traspaso histórico antes de editarlo o eliminarlo.": "storage_message.revisa_y_vincula_el_traspaso_historico_antes_de_editarlo_o_eliminarlo",
  "Vincula o revisa los traspasos históricos de esta cartera antes de renombrarla o eliminarla.": "storage_message.vincula_o_revisa_los_traspasos_historicos_de_esta_cartera_antes_de_renombrarla",
  "El movimiento vinculado ya no está disponible. Revisa el historial antes de continuar.": "storage_message.el_movimiento_vinculado_ya_no_esta_disponible_revisa_el_historial_antes_de",
  "El movimiento vinculado no tiene una fecha admitida por el calendario.": "storage_message.el_movimiento_vinculado_no_tiene_una_fecha_admitida_por_el_calendario",
  "La ocurrencia no tiene un mes válido.": "storage_message.la_ocurrencia_no_tiene_un_mes_valido",
  "La ocurrencia vinculada ya no está disponible. Revisa la regla antes de continuar.": "storage_message.la_ocurrencia_vinculada_ya_no_esta_disponible_revisa_la_regla_antes_de",
  "El principal y su historial están protegidos. Revisa esta liquidación desde Deudas; puedes tramitarla desde Movimientos.": "storage_message.el_principal_y_su_historial_estan_protegidos_revisa_esta_liquidacion_desde_deudas",
  "Revisa la migración del gasto compartido histórico antes de editarlo.": "storage_message.revisa_la_migracion_del_gasto_compartido_historico_antes_de_editarlo",
  "Este traspaso histórico requiere revisión y vinculación antes de editar sus extremos.": "storage_message.este_traspaso_historico_requiere_revision_y_vinculacion_antes_de_editar_sus_extremos",
  "La partida ya no existe.": "storage_message.la_partida_ya_no_existe",
  "La liquidación ya no existe.": "storage_message.la_liquidacion_ya_no_existe",
  "Datos seleccionados borrados. El estado anterior está en «Copias de recuperación».": "storage_message.datos_seleccionados_borrados_el_estado_anterior_esta_en_copias_de_recuperacion",
  "No se pudo leer el archivo.": "storage_message.no_se_pudo_leer_el_archivo",
  "Datos sustituidos. La copia anterior está disponible en «Copias de recuperación».": "storage_message.datos_sustituidos_la_copia_anterior_esta_disponible_en_copias_de_recuperacion",
  "No se pudo guardar la copia de recuperación o los datos nuevos. No se ha aplicado la sustitución. Comprueba el espacio disponible y si los datos cambiaron en otra pestaña.": "storage_message.no_se_pudo_guardar_la_copia_de_recuperacion_o_los_datos_nuevos",
  "La partida habitual del préstamo está ausente o archivada. Edita el préstamo y selecciona una partida activa antes de registrar la cuota.": "storage_message.la_partida_habitual_del_prestamo_esta_ausente_o_archivada_edita_el_prestamo",
  "Hay un borrado pendiente de confirmación.": "storage_message.hay_un_borrado_pendiente_de_confirmacion",
  "No se ha aplicado el borrado. No se pudo guardar una copia recuperable o los datos cambiaron en otra pestaña.": "storage_message.no_se_ha_aplicado_el_borrado_no_se_pudo_guardar_una_copia",
  "Restablecer datos de demostración": "storage_message.restablecer_datos_de_demostracion",
  "Vincular traspasos históricos (migración a 2.6)": "storage_message.vincular_traspasos_historicos_migracion_a_2_6",
  "Migrar gastos compartidos a 2.7": "storage_message.migrar_gastos_compartidos_a_2_7",
  "almacenamiento no disponible": "storage_message.almacenamiento_no_disponible",
  "Eliminar contacto": "storage_message.eliminar_contacto",
  "Eliminar cuenta": "storage_message.eliminar_cuenta",
  "Eliminar préstamo": "storage_message.eliminar_prestamo",
  "Eliminar movimiento": "storage_message.eliminar_movimiento",
  "Reglas de movimientos": "storage_message.reglas_de_movimientos",
  "Identidades de ocurrencias": "storage_message.identidades_de_ocurrencias",
  "Liquidaciones personales": "storage_message.liquidaciones_personales",
  "Movimientos": "storage_message.movimientos",
  "Presupuestos": "storage_message.presupuestos",
  "Objetivos y aprobaciones mensuales": "storage_message.objetivos_y_aprobaciones_mensuales",
  "Reglas recurrentes": "storage_message.reglas_recurrentes",
  "Arrastres": "storage_message.arrastres",
  "Fotografías históricas": "storage_message.fotografias_historicas",
  "Paquetes": "storage_message.paquetes",
  "Contactos": "storage_message.contactos",
  "Préstamos": "storage_message.prestamos",
  "Carteras": "storage_message.carteras",
  "Reintegros": "storage_message.reintegros",
  "Transferencias": "storage_message.transferencias"
} as const;
export function storageOwnedText(value:string,t:typeof translate,depth=0):string{
 if(Object.hasOwn(keys,value))return t(keys[value as keyof typeof keys]);
 if(depth>8)return value;
 const inner=(text:string)=>storageOwnedText(text,t,depth+1);
 const load='No se han podido cargar los datos: ',loadEnd='. Los datos guardados no se han sobrescrito.',clear='No se ha aplicado el borrado. ',unchanged=' No se ha modificado ningún dato.';
 if(value.startsWith(load)&&value.endsWith(loadEnd))return t('storage.wrap.load',{reason:inner(value.slice(load.length,-loadEnd.length))});
 if(value.startsWith(clear))return t('storage.wrap.clear',{reason:inner(value.slice(clear.length))});
 if(value.endsWith(unchanged))return t('storage.wrap.import',{reason:inner(value.slice(0,-unchanged.length))});
 const numeric=/^debe ser un número (entero )?válido, mayor o igual que (-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\.$/i.exec(value);
 if(numeric)return t(numeric[1]?'storage.backup.integer':'storage.backup.number',{minimum:numeric[2]});
 // Field paths (including unknown JSON keys) are opaque schema identifiers. No financial parsing.
 const separator=value.lastIndexOf(': ');
 if(separator>0){const reason=value.slice(separator+2),translated=inner(reason);if(translated!==reason||Object.hasOwn(keys,reason)||/^debe ser un número /.test(reason))return t('storage.backup.path',{path:value.slice(0,separator),reason:translated});}
 return domainOwnedText(value,t);
}
export function restorationTitleText(value:string,t:typeof translate):string{
 const imported=/^Importar «([\s\S]*)»$/.exec(value);
 return imported?t('storage.title.import',{file:imported[1]}):storageOwnedText(value,t);
}
const warningPatterns=[
 {pattern:/^(\d+) traspasos históricos inequívocos: sus importes se excluyen de ingresos y gastos, sin reescribir los originales\.$/,one:'storage.warning.transferPairs.one',other:'storage.warning.transferPairs'},
 {pattern:/^(\d+) pares pueden vincularse desde el aviso de traspasos históricos, tras revisar y confirmar la copia previa\.$/,one:'storage.warning.migratablePairs.one',other:'storage.warning.migratablePairs'},
 {pattern:/^(\d+) pares históricos sin carteras existentes: se excluyen de ingresos y gastos, pero no se pueden vincular\. Se conservan los originales sin crear carteras ni contrapartidas\.$/,one:'storage.warning.missingWalletPairs.one',other:'storage.warning.missingWalletPairs'},
 {pattern:/^(\d+) registros de posibles traspasos históricos sin correspondencia inequívoca\. Se conservan intactos y mantienen sus cálculos anteriores\. Su edición individual está bloqueada; requieren revisión manual con una copia de seguridad\.$/,one:'storage.warning.unresolved.one',other:'storage.warning.unresolved'},
] as const;
export function backupWarningText(value:string,language:Language,t:typeof translate):string{
 for(const warning of warningPatterns){const match=warning.pattern.exec(value);if(match){const count=Number(match[1]);if(Number.isSafeInteger(count))return t(pluralCategory(count,language)==='one'?warning.one:warning.other,{count:new Intl.NumberFormat(languages[language].locale).format(count)});}}
 return storageOwnedText(value,t);
}
export type DeletionSource={data:FinanceData;target:DeletionTarget};
type Format=ReturnType<typeof presentationFormatters>;
/** The original report continues to guard the operation. This copy is used for rendering only. */
export function deletionReportForDisplay(report:DeletionReport,source:DeletionSource|undefined,language:Language,t:typeof translate,format:Format):DeletionReport{
 const notice=(value:string)=>{
  const {data,target}=source??{};
  if(data&&target){
   if(target.kind==='wallet'){
    const w=data.wallets.find(w=>w.id===target.id);
    if(w&&value===`Saldo base que se retiraría del patrimonio: ${presentationMoney(w.initialBalance,'es')}.`)return t('storage.deletion.wallet',{amount:presentationMoney(w.initialBalance,language)});
   }
   if(target.kind==='loan'){
    const l=data.loans.find(l=>l.id===target.id);
    if(l&&value===`Se retirará el seguimiento de ${l.name} (${l.entity}), con capital inicial ${presentationMoney(l.principal,'es')}. La eliminación no registra ningún pago.`)return t('storage.deletion.loan',{name:l.name,entity:l.entity,amount:presentationMoney(l.principal,language)});
   }
   if(target.kind==='transaction'){
    const tx=data.transactions.find(tx=>tx.id===target.id);
    if(tx&&value===`Se retirará el movimiento de ${presentationMoney(tx.amount,'es')} del ${tx.date}; sus efectos en saldo y presupuesto se recalcularán.`)return t('storage.deletion.transaction',{amount:presentationMoney(tx.amount,language),date:format.formatDate(tx.date,{day:'2-digit',month:'2-digit',year:'numeric'})});
   }
  }
  return storageOwnedText(value,t);
 };
 const blocker=(value:string)=>{
  for(const relation of report.relations)if(value===`${relation.label}: ${relation.count}. Debes revisar estas relaciones antes de eliminar el elemento.`)return t('storage.deletion.blocker',{label:storageOwnedText(relation.label,t),count:new Intl.NumberFormat(languages[language].locale).format(relation.count)});
  return storageOwnedText(value,t);
 };
 return {...report,title:storageOwnedText(report.title,t),name:!source&&report.title==='Confirmar borrado seleccionado'&&report.name==='Datos seleccionados de todas las fechas'?storageOwnedText(report.name,t):report.name,relations:report.relations.map(r=>({...r,label:storageOwnedText(r.label,t)})),notices:report.notices.map(notice),blockers:report.blockers.map(blocker)};
}
