import type {translate} from './messages';

/** Owned planning errors and preview reasons only. Never pass personal text to this adapter. */
const keys={
 "Elige una familia del mismo tipo. No se permite cambiar entre Ingresos y Gastos.":"budgets.invalidFamilyMove",
  "La partida o su familia está archivada. Reactívala antes de crear o revisar el arrastre.": "planning_message.la_partida_o_su_familia_esta_archivada_reactivala_antes_de",
  "Arrastre global bloqueado: esta partida tiene un desglose mensual. Distribuye su previsión manualmente.": "planning_message.arrastre_global_bloqueado_esta_partida_tiene_un_desglose_mensual_distribuye",
  "El origen debe ser un mes transcurrido y cerrado temporalmente.": "planning_message.el_origen_debe_ser_un_mes_transcurrido_y_cerrado_temporalmente",
  "El destino ya origina otro arrastre: no se permiten cascadas.": "planning_message.el_destino_ya_origina_otro_arrastre_no_se_permiten_cascadas",
  "El origen ya recibió arrastre: no se permiten cascadas.": "planning_message.el_origen_ya_recibio_arrastre_no_se_permiten_cascadas",
  "Revisa y migra el gasto compartido histórico antes de calcular remanentes.": "planning_message.revisa_y_migra_el_gasto_compartido_historico_antes_de_calcular",
  "Hay traspasos históricos ambiguos que requieren revisión.": "planning_message.hay_traspasos_historicos_ambiguos_que_requieren_revision",
  "Importe fuera del rango exacto.": "planning_message.importe_fuera_del_rango_exacto",
  "Partida o familia archivada: no se generan nuevas previsiones.": "planning_message.partida_o_familia_archivada_no_se_generan_nuevas_previsiones",
  "Desglose mensual activo: un importe global no puede sustituir su distribución. Edita los subítems manualmente.": "planning_message.desglose_mensual_activo_un_importe_global_no_puede_sustituir_su",
  "La copia contiene subítems archivados: revisa manualmente la distribución del destino.": "planning_message.la_copia_contiene_subitems_archivados_revisa_manualmente_la_distribucion_del",
  "Mes aprobado o previamente aprobado: edición masiva bloqueada.": "planning_message.mes_aprobado_o_previamente_aprobado_edicion_masiva_bloqueada",
  "Solo se generan copias/recurrencias en el mes actual o futuro.": "planning_message.solo_se_generan_copias_recurrencias_en_el_mes_actual_o",
  "Conflicto existente: omitido por defecto; requiere elección individual.": "planning_message.conflicto_existente_omitido_por_defecto_requiere_eleccion_individual",
  "Ya coincide; no se duplica ni se vuelve a guardar.": "planning_message.ya_coincide_no_se_duplica_ni_se_vuelve_a_guardar",
  "Los destinos deben ser posteriores al mes origen.": "planning_message.los_destinos_deben_ser_posteriores_al_mes_origen",
  "El origen no tiene planificación guardada.": "planning_message.el_origen_no_tiene_planificacion_guardada",
  "Selecciona partidas o el objetivo de ahorro.": "planning_message.selecciona_partidas_o_el_objetivo_de_ahorro",
  "Partidas seleccionadas duplicadas.": "planning_message.partidas_seleccionadas_duplicadas",
  "Alguna partida seleccionada no existe en el origen guardado.": "planning_message.alguna_partida_seleccionada_no_existe_en_el_origen_guardado",
  "Copia de base guardada; no incluye arrastres ni aprobaciones.": "planning_message.copia_de_base_guardada_no_incluye_arrastres_ni_aprobaciones",
  "Copia del objetivo guardado.": "planning_message.copia_del_objetivo_guardado",
  "Reglas coincidentes: elige una sola propuesta para esta partida/mes.": "planning_message.reglas_coincidentes_elige_una_sola_propuesta_para_esta_partida_mes",
  "Guardar regla únicamente. No genera ni borra presupuestos o movimientos.": "planning_message.guardar_regla_unicamente_no_genera_ni_borra_presupuestos_o_movimientos",
  "La regla ya no existe.": "planning_message.la_regla_ya_no_existe",
  "Eliminar regla; se conservan las previsiones generadas y su procedencia histórica.": "planning_message.eliminar_regla_se_conservan_las_previsiones_generadas_y_su_procedencia",
  "Selecciona al menos una partida y un importe.": "planning_message.selecciona_al_menos_una_partida_y_un_importe",
  "Selección de arrastre duplicada.": "planning_message.seleccion_de_arrastre_duplicada",
  "Destino aprobado o previamente aprobado: bloqueado.": "planning_message.destino_aprobado_o_previamente_aprobado_bloqueado",
  "Arrastre ya existente; no se duplica.": "planning_message.arrastre_ya_existente_no_se_duplica",
  "Importe fuera del remanente positivo disponible.": "planning_message.importe_fuera_del_remanente_positivo_disponible",
  "El arrastre ya no existe.": "planning_message.el_arrastre_ya_no_existe",
  "El remanente actual es menor: elimina el ajuste y revisa otro importe.": "planning_message.el_remanente_actual_es_menor_elimina_el_ajuste_y_revisa",
  "Eliminar solo este ajuste; conserva la fotografía y marca el contenido modificado.": "planning_message.eliminar_solo_este_ajuste_conserva_la_fotografia_y_marca_el",
  "Revisar expresamente la observación actual sin recalcular el importe del ajuste.": "planning_message.revisar_expresamente_la_observacion_actual_sin_recalcular_el_importe_del",
  "La vista previa ha caducado o los datos han cambiado. Cancela y vuelve a revisar.": "planning_message.la_vista_previa_ha_caducado_o_los_datos_han_cambiado",
  "La propuesta cambió; vuelve a previsualizar.": "planning_message.la_propuesta_cambio_vuelve_a_previsualizar",
  "El historial es inmutable y debe conservar exactamente las fotografías anteriores.": "planning_message.el_historial_es_inmutable_y_debe_conservar_exactamente_las_fotografias",
  "El arrastre no puede reescribirse; revisa o elimina el ajuste individual.": "planning_message.el_arrastre_no_puede_reescribirse_revisa_o_elimina_el_ajuste",
  "No se puede aplicar arrastre por lote a un mes previamente aprobado.": "planning_message.no_se_puede_aplicar_arrastre_por_lote_a_un_mes",
  "La observación de arrastre no coincide con el origen guardado.": "planning_message.la_observacion_de_arrastre_no_coincide_con_el_origen_guardado",
  "Automatización: objeto inválido": "planning_message.automatizacion_objeto_invalido",
  "Automatización: texto inválido": "planning_message.automatizacion_texto_invalido",
  "Automatización: fecha ISO inválida": "planning_message.automatizacion_fecha_iso_invalida",
  "Automatización: colección inválida o límite de registros superado": "planning_message.automatizacion_coleccion_invalida_o_limite_de_registros_superado",
  "Automatización: identificadores duplicados": "planning_message.automatizacion_identificadores_duplicados",
  "Automatización: destino inválido": "planning_message.automatizacion_destino_invalido",
  "Automatización: el ahorro no tiene código de partida": "planning_message.automatizacion_el_ahorro_no_tiene_codigo_de_partida",
  "Automatización: importe de regla no representable": "planning_message.automatizacion_importe_de_regla_no_representable",
  "Automatización: frecuencia inválida": "planning_message.automatizacion_frecuencia_invalida",
  "Automatización: fin de regla anterior al inicio": "planning_message.automatizacion_fin_de_regla_anterior_al_inicio",
  "Automatización: estado de regla inválido": "planning_message.automatizacion_estado_de_regla_invalido",
  "Automatización: 3.0 exige campos nuevos de planificación": "planning_message.automatizacion_3_0_exige_campos_nuevos_de_planificacion",
  "Automatización: procedencia inválida": "planning_message.automatizacion_procedencia_invalida",
  "Automatización: procedencia sin mes de planificación": "planning_message.automatizacion_procedencia_sin_mes_de_planificacion",
  "Automatización: origen de copia inválido": "planning_message.automatizacion_origen_de_copia_invalido",
  "Automatización: fuente inesperada": "planning_message.automatizacion_fuente_inesperada",
  "Automatización: nombre de regla inesperado": "planning_message.automatizacion_nombre_de_regla_inesperado",
  "Automatización: el destino debe ser el mes consecutivo": "planning_message.automatizacion_el_destino_debe_ser_el_mes_consecutivo",
  "Automatización: el origen no estaba cerrado temporalmente": "planning_message.automatizacion_el_origen_no_estaba_cerrado_temporalmente",
  "Automatización: solo gastos admiten arrastre": "planning_message.automatizacion_solo_gastos_admiten_arrastre",
  "Automatización: arrastre excede el remanente observado": "planning_message.automatizacion_arrastre_excede_el_remanente_observado",
  "Automatización: firma de origen inválida": "planning_message.automatizacion_firma_de_origen_invalida",
  "Automatización: arrastre sin mes destino": "planning_message.automatizacion_arrastre_sin_mes_destino",
  "Automatización: no se admiten cascadas de arrastre": "planning_message.automatizacion_no_se_admiten_cascadas_de_arrastre",
  "Automatización: observación inconsistente con el origen actual": "planning_message.automatizacion_observacion_inconsistente_con_el_origen_actual",
  "Automatización: historial vacío": "planning_message.automatizacion_historial_vacio",
  "Automatización: historial sin última fotografía": "planning_message.automatizacion_historial_sin_ultima_fotografia",
  "Automatización: historial fuera de orden o incoherente": "planning_message.automatizacion_historial_fuera_de_orden_o_incoherente",
  "Automatización: límite de fotografías históricas superado": "planning_message.automatizacion_limite_de_fotografias_historicas_superado",
  "Periodo inválido; usa AAAA-MM entre 0001 y 9999.": "planning_message.periodo_invalido_usa_aaaa_mm_entre_0001_y_9999",
  "Importe inválido o fuera del rango seguro de céntimos.": "planning_message.importe_invalido_o_fuera_del_rango_seguro_de_centimos",
  "Usa un importe no negativo con hasta dos decimales (15,50 o 15.50).": "planning_message.usa_un_importe_no_negativo_con_hasta_dos_decimales_15",
  "Importe fuera del rango seguro de céntimos.": "planning_message.importe_fuera_del_rango_seguro_de_centimos",
  "Previsión monetaria inválida.": "planning_message.prevision_monetaria_invalida",
  "Selecciona entre 1 y 12 meses consecutivos.": "planning_message.selecciona_entre_1_y_12_meses_consecutivos",
  "Importes de subítems pendientes de corregir": "planning_message.invalidSubitems",
  "Copia de base guardada; no incluye arrastres ni aprobaciones. Pendiente de desglose: se conserva el total sin inventar asignaciones.": "automation.reason.copyPending",
  "Copia de base guardada; no incluye arrastres ni aprobaciones. Incluye la distribución mensual por ID, sin arrastres.": "automation.reason.copyDistributed"
} as const;
export function planningOwnedText(value:string,t:typeof translate):string{
 if(Object.hasOwn(keys,value))return t(keys[value as keyof typeof keys]);
 const missing='Automatización: falta ',unknown='Automatización: campo no reconocido ';
 if(value.startsWith(missing))return t('automation.missingField',{field:value.slice(missing.length)});
 if(value.startsWith(unknown))return t('automation.unknownField',{field:value.slice(unknown.length)});
 return value;
}


import type {FinanceData} from '../utils/backup';
import type {AutomationPreview,AutomationRow} from '../utils/planningAutomation';
import {carryObservation} from '../utils/planningCarry';
import {formatPlanningCents} from '../utils/planningMoney';
/** Read the original preview, without changing reasons, requests, rules or financial inputs. */
export function automationReasonText(data:FinanceData,preview:AutomationPreview,row:AutomationRow,t:typeof translate,money:(cents:number)=>string=formatPlanningCents):string{
 const reason=row.reason,name=row.origin?.ruleName;
 if(row.origin?.kind==='rule'&&name!==undefined){
  for(const [frequency,source] of [['monthly','mensual'],['quarterly','trimestral'],['yearly','anual']] as const){
   const base=`Regla ${name} (${source}).`,pending=' Pendiente de desglose: se conserva el total sin inventar asignaciones.';
   if(reason===base||reason===base+pending)return t(reason===base?'automation.reason.rule':'automation.reason.rulePending',{name,frequency:t(`automation.frequency.${frequency}`)});
  }
 }
 if(preview.request.kind==='carry'&&row.status==='apply'&&row.code){
  try{
   const observation=carryObservation(data,preview.request.source,row.code),amount=preview.request.amounts.find(a=>a.code===row.code)?.amountCents;
   if(amount!==undefined){
    const source=`Origen base ${formatPlanningCents(observation.baseCents)}, propio ejecutado ${formatPlanningCents(observation.executedCents)}, remanente ${formatPlanningCents(observation.remainder)}. Ajuste separado: +${formatPlanningCents(amount)}; no es dinero real.`;
    if(reason===source)return t('automation.reason.carry',{base:money(observation.baseCents),actual:money(observation.executedCents),remainder:money(observation.remainder),adjustment:money(amount)});
   }
  }catch{/* Unknown or malformed presentation retains its original diagnostic. */}
 }
 return planningOwnedText(reason,t);
}
