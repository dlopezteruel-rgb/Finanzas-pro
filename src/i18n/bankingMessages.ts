import type {translate} from './messages';
import type {FinanceData} from '../utils/backup';
import type {TreasuryEvent} from '../utils/treasury';
import type {presentationFormatters} from './presentation';
import {planningOwnedText} from './planningMessages';
/** Known application diagnostics only. Never pass user names, concepts, notes or history. */
const keys={
  "Crea el compromiso antes de liquidarlo.": "banking_message.crea_el_compromiso_antes_de_liquidarlo",
  "El historial se registra por su propia operación.": "banking_message.el_historial_se_registra_por_su_propia_operacion",
  "No se puede cancelar un compromiso con historial.": "banking_message.no_se_puede_cancelar_un_compromiso_con_historial",
  "El compromiso no está disponible.": "banking_message.el_compromiso_no_esta_disponible",
  "Identificador de liquidación ya utilizado.": "banking_message.identificador_de_liquidacion_ya_utilizado",
  "Un cobro/pago futuro debe quedar pendiente de tramitar.": "banking_message.un_cobro_pago_futuro_debe_quedar_pendiente_de_tramitar",
  "El pago/cobro supera el saldo no reservado.": "banking_message.el_pago_cobro_supera_el_saldo_no_reservado",
  "Selecciona una cartera válida.": "banking_message.selecciona_una_cartera_valida",
  "Identidad bancaria duplicada.": "banking_message.identidad_bancaria_duplicada",
  "Liquidación bancaria inexistente.": "banking_message.liquidacion_bancaria_inexistente",
  "No se puede tramitar un pago/cobro futuro.": "banking_message.no_se_puede_tramitar_un_pago_cobro_futuro",
  "Esta regla está eliminada. Crea una nueva identidad.": "banking_message.esta_regla_esta_eliminada_crea_una_nueva_identidad",
  "Selecciona una partida existente o histórica del mismo tipo.": "banking_message.selecciona_una_partida_existente_o_historica_del_mismo_tipo",
  "Selecciona una partida activa para la regla.": "banking_message.selecciona_una_partida_activa_para_la_regla",
  "La regla ya no existe.": "banking_message.la_regla_ya_no_existe",
  "Fecha inválida.": "banking_message.fecha_invalida",
  "Reduce el periodo: máximo 12.000 ocurrencias por consulta.": "banking_message.reduce_el_periodo_maximo_12_000_ocurrencias_por_consulta",
  "Acción de ocurrencia inválida.": "banking_message.accion_de_ocurrencia_invalida",
  "La vista previa ha cambiado. Revisa de nuevo antes de confirmar.": "banking_message.la_vista_previa_ha_cambiado_revisa_de_nuevo_antes_de_confirmar",
  "Selecciona entre 1 y 500 ocurrencias distintas.": "banking_message.selecciona_entre_1_y_500_ocurrencias_distintas",
  "La ocurrencia ya no está disponible.": "banking_message.la_ocurrencia_ya_no_esta_disponible",
  "Hay movimientos manuales parecidos. Revisa la coincidencia y confirma crear otro, o bien omite esta ocurrencia.": "banking_message.hay_movimientos_manuales_parecidos_revisa_la_coincidencia_y_confirma_crear_otro_o",
  "La cartera de la regla no existe.": "banking_message.la_cartera_de_la_regla_no_existe",
  "La partida de la regla está ausente o archivada. Selecciona una partida activa antes de registrar.": "banking_message.la_partida_de_la_regla_esta_ausente_o_archivada_selecciona_una_partida",
  "Identificador de movimiento ya utilizado.": "banking_message.identificador_de_movimiento_ya_utilizado",
  "Usa una fecha real y entre 1 y 366 días.": "banking_message.usa_una_fecha_real_y_entre_1_y_366_dias",
  "Hay compromisos o repartos sin vencimiento: se muestran separados y no se inventa una fecha de cobro/pago.": "banking_message.hay_compromisos_o_repartos_sin_vencimiento_se_muestran_separados_y_no_se",
  "Los movimientos y compromisos vencidos se aplican al inicio del horizonte como supuesto pendiente de revisión.": "banking_message.los_movimientos_y_compromisos_vencidos_se_aplican_al_inicio_del_horizonte_como",
  "Hay movimientos futuros marcados tramitados en el historial: el saldo de partida conserva el cálculo bancario existente.": "banking_message.hay_movimientos_futuros_marcados_tramitados_en_el_historial_el_saldo_de_partida",
  "La planificación presupuestaria es una previsión económica; no se suma como un flujo adicional de tesorería.": "banking_message.la_planificacion_presupuestaria_es_una_prevision_economica_no_se_suma_como_un",
  "Posible déficit: el saldo proyectado resulta negativo en al menos una fecha.": "banking_message.posible_deficit_el_saldo_proyectado_resulta_negativo_en_al_menos_una_fecha",
  "Finanzas inteligentes: campos inválidos o no reconocidos.": "banking_message.finanzas_inteligentes_campos_invalidos_o_no_reconocidos",
  "Finanzas inteligentes: texto inválido (máximo 500 caracteres).": "banking_message.finanzas_inteligentes_texto_invalido_maximo_500_caracteres",
  "Finanzas inteligentes: identificador demasiado largo.": "banking_message.finanzas_inteligentes_identificador_demasiado_largo",
  "Finanzas inteligentes: fecha real requerida (0001–9999).": "banking_message.finanzas_inteligentes_fecha_real_requerida_0001_9999",
  "Finanzas inteligentes: estado inválido.": "banking_message.finanzas_inteligentes_estado_invalido",
  "Finanzas inteligentes: importe positivo representable en céntimos requerido.": "banking_message.finanzas_inteligentes_importe_positivo_representable_en_centimos_requerido",
  "Finanzas inteligentes: identificadores duplicados.": "banking_message.finanzas_inteligentes_identificadores_duplicados",
  "Finanzas inteligentes: enlaces sin su registro persistente.": "banking_message.finanzas_inteligentes_enlaces_sin_su_registro_persistente",
  "Finanzas inteligentes: el ID de regla no puede incluir @.": "banking_message.finanzas_inteligentes_el_id_de_regla_no_puede_incluir",
  "Finanzas inteligentes: tipo o frecuencia inválidos.": "banking_message.finanzas_inteligentes_tipo_o_frecuencia_invalidos",
  "Finanzas inteligentes: cartera de regla inexistente.": "banking_message.finanzas_inteligentes_cartera_de_regla_inexistente",
  "Finanzas inteligentes: fin anterior al inicio.": "banking_message.finanzas_inteligentes_fin_anterior_al_inicio",
  "Finanzas inteligentes: día fuera de 1–31.": "banking_message.finanzas_inteligentes_dia_fuera_de_1_31",
  "Finanzas inteligentes: regla eliminada activa.": "banking_message.finanzas_inteligentes_regla_eliminada_activa",
  "Finanzas inteligentes: identidad de ocurrencia inválida.": "banking_message.finanzas_inteligentes_identidad_de_ocurrencia_invalida",
  "Finanzas inteligentes: ocurrencia omitida con movimiento.": "banking_message.finanzas_inteligentes_ocurrencia_omitida_con_movimiento",
  "Finanzas inteligentes: ocurrencia y movimiento deben permanecer vinculados.": "banking_message.finanzas_inteligentes_ocurrencia_y_movimiento_deben_permanecer_vinculados",
  "Finanzas inteligentes: dirección de compromiso inválida.": "banking_message.finanzas_inteligentes_direccion_de_compromiso_invalida",
  "Finanzas inteligentes: contacto del compromiso inexistente.": "banking_message.finanzas_inteligentes_contacto_del_compromiso_inexistente",
  "Finanzas inteligentes: vencimiento anterior al compromiso.": "banking_message.finanzas_inteligentes_vencimiento_anterior_al_compromiso",
  "Finanzas inteligentes: nota de liquidación inválida.": "banking_message.finanzas_inteligentes_nota_de_liquidacion_invalida",
  "Finanzas inteligentes: liquidación duplicada, cancelada o inválida.": "banking_message.finanzas_inteligentes_liquidacion_duplicada_cancelada_o_invalida",
  "Finanzas inteligentes: ajuste sin banco inválido.": "banking_message.finanzas_inteligentes_ajuste_sin_banco_invalido",
  "Finanzas inteligentes: liquidación y banco inconsistentes.": "banking_message.finanzas_inteligentes_liquidacion_y_banco_inconsistentes",
  "Finanzas inteligentes: cobros/pagos superiores al principal (incluidos pendientes).": "banking_message.finanzas_inteligentes_cobros_pagos_superiores_al_principal_incluidos_pendientes",
  "Finanzas inteligentes: movimiento periódico incompatible o huérfano.": "banking_message.finanzas_inteligentes_movimiento_periodico_incompatible_o_huerfano",
  "Finanzas inteligentes: flujo de principal incompatible o huérfano.": "banking_message.finanzas_inteligentes_flujo_de_principal_incompatible_o_huerfano",
  "Finanzas inteligentes: una liquidación futura debe quedar pendiente.": "banking_message.finanzas_inteligentes_una_liquidacion_futura_debe_quedar_pendiente",
  "Finanzas inteligentes: los nuevos movimientos periódicos deben crearse pendientes.": "banking_message.finanzas_inteligentes_los_nuevos_movimientos_periodicos_deben_crearse_pendientes",
  "Finanzas inteligentes: elimina reglas mediante una baja trazable.": "banking_message.finanzas_inteligentes_elimina_reglas_mediante_una_baja_trazable",
  "Finanzas inteligentes: no se puede reescribir o eliminar una identidad de ocurrencia.": "banking_message.finanzas_inteligentes_no_se_puede_reescribir_o_eliminar_una_identidad_de_ocurrencia",
  "Finanzas inteligentes: compromiso con historial: principal, contraparte y dirección protegidos.": "banking_message.finanzas_inteligentes_compromiso_con_historial_principal_contraparte_y_direccion_protegidos",
  "Finanzas inteligentes: el historial de liquidaciones es inmutable.": "banking_message.finanzas_inteligentes_el_historial_de_liquidaciones_es_inmutable",
  "Finanzas inteligentes: un movimiento futuro debe permanecer pendiente de tramitar.": "banking_message.finanzas_inteligentes_un_movimiento_futuro_debe_permanecer_pendiente_de_tramitar",
  "Finanzas inteligentes: conserva el origen del movimiento periódico.": "banking_message.finanzas_inteligentes_conserva_el_origen_del_movimiento_periodico",
  "Finanzas inteligentes: conserva el vínculo de liquidación.": "banking_message.finanzas_inteligentes_conserva_el_vinculo_de_liquidacion",
  "Día inválido.": "banking_message.dia_invalido",
  "Crea primero una cartera y una partida.": "banking_message.createFirst"
} as const;
export function bankingOwnedText(value:string,t:typeof translate):string{
 const list=/^Finanzas inteligentes: lista inválida o superior al límite (\d+)\.$/.exec(value);
 if(list)return t("banking_message.listLimit",{max:list[1]});
 return Object.hasOwn(keys,value)?t(keys[value as keyof typeof keys]):planningOwnedText(value,t);
}
type DateFormatter=ReturnType<typeof presentationFormatters>['formatDate'];
const dateOptions={day:'2-digit',month:'2-digit',year:'numeric'} as const;
/** Recognise only the treasury engine's own complete diagnostics; IDs stay literal. */
export function treasuryWarningText(value:string,data:FinanceData,_from:string,t:typeof translate,date:DateFormatter):string{
 for(const tx of data.transactions)if(value===`Movimiento ${tx.id}: cartera no disponible; excluido de la proyección.`)return t('treasury.warning.wallet',{id:tx.id});
 for(const loan of data.loans){
  if(value===`Préstamo ${loan.id}: cartera habitual no líquida o no disponible; cuotas excluidas.`)return t('treasury.warning.loanWallet',{id:loan.id});
  if(value===`Préstamo ${loan.id}: el motor histórico también reconoce cuotas por nombre. Revisa sus enlaces; no se reescribe el historial.`)return t('treasury.warning.loanHistory',{id:loan.id});
  if(value===`Préstamo ${loan.id}: vencidos agregados según cuotas teóricas y tramitadas; revisa el calendario bancario real.`)return t('treasury.warning.arrears',{id:loan.id});
 }
 const match=/^Regla (.*) el (\d{4}-\d{2}-\d{2}): coincidencia manual sin enlace inequívoco\. Se muestran ambos escenarios de flujo; omite la propuesta si es la misma obligación\.$/.exec(value);
 if(match&&data.intelligentFinance?.recurringRules.some(r=>r.id===match[1]))return t('treasury.warning.collision',{id:match[1],date:date(match[2],dateOptions)});
 return bankingOwnedText(value,t);
}
/** Generated projection labels only; descriptions of recorded transactions remain user data. */
export function treasuryConceptText(event:TreasuryEvent,data:FinanceData,from:string,t:typeof translate,date:DateFormatter):string{
 if(event.source!=='loan')return event.concept;
 const loan=data.loans.find(l=>l.id===event.originId);if(!loan)return event.concept;
 if(event.concept===`Cuotas vencidas estimadas a ${from}: ${loan.name}`)return t('treasury.concept.arrears',{date:date(from,dateOptions),name:loan.name});
 if(event.concept===`Cuota estimada: ${loan.name}`)return t('treasury.concept.instalment',{name:loan.name});
 return event.concept;
}
