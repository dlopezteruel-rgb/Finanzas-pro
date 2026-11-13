import type {translate} from './messages';
import {bankingOwnedText} from './bankingMessages';
/** Complete owned diagnostics; personal names, descriptions, notes and history are never passed here. */
const keys={
  "El importe debe ser finito, no negativo y expresado en céntimos exactos.": "shared_message.el_importe_debe_ser_finito_no_negativo_y_expresado_en_centimos_exactos",
  "El importe debe ser positivo.": "shared_message.el_importe_debe_ser_positivo",
  "Selecciona contactos distintos para todos los participantes.": "shared_message.selecciona_contactos_distintos_para_todos_los_participantes",
  "El participante de la deuda no existe.": "shared_message.el_participante_de_la_deuda_no_existe",
  "Un gasto compartido debe ser un gasto independiente.": "shared_message.un_gasto_compartido_debe_ser_un_gasto_independiente",
  "La cartera o el registro de liquidaciones del gasto no existe.": "shared_message.la_cartera_o_el_registro_de_liquidaciones_del_gasto_no_existe",
  "El total debe coincidir con la parte propia y las deudas, sin diferencias de céntimos.": "shared_message.el_total_debe_coincidir_con_la_parte_propia_y_las_deudas_sin",
  "No puede eliminarse un contacto con gastos vinculados.": "shared_message.no_puede_eliminarse_un_contacto_con_gastos_vinculados",
  "El cobro supera la deuda pendiente o duplica un cobro ya registrado.": "shared_message.el_cobro_supera_la_deuda_pendiente_o_duplica_un_cobro_ya_registrado",
  "Liquidación duplicada o participante inexistente.": "shared_message.liquidacion_duplicada_o_participante_inexistente",
  "Fecha o tipo de liquidación inválido.": "shared_message.fecha_o_tipo_de_liquidacion_invalido",
  "No se puede liquidar un gasto todavía no tramitado.": "shared_message.no_se_puede_liquidar_un_gasto_todavia_no_tramitado",
  "Una compensación no puede crear un movimiento bancario.": "shared_message.una_compensacion_no_puede_crear_un_movimiento_bancario",
  "El reintegro y su liquidación deben guardarse y modificarse juntos.": "shared_message.el_reintegro_y_su_liquidacion_deben_guardarse_y_modificarse_juntos",
  "Hay un reintegro sin gasto, participante o liquidación correspondiente.": "shared_message.hay_un_reintegro_sin_gasto_participante_o_liquidacion_correspondiente",
  "Revisa y migra este gasto histórico antes de liquidarlo.": "shared_message.revisa_y_migra_este_gasto_historico_antes_de_liquidarlo",
  "El gasto original aún no está tramitado.": "shared_message.el_gasto_original_aun_no_esta_tramitado",
  "La liquidación o el participante ya no coincide.": "shared_message.la_liquidacion_o_el_participante_ya_no_coincide",
  "Esta liquidación ya se ha registrado. Recarga antes de repetir el cobro.": "shared_message.esta_liquidacion_ya_se_ha_registrado_recarga_antes_de_repetir_el_cobro",
  "La cartera receptora debe existir.": "shared_message.la_cartera_receptora_debe_existir",
  "El contacto no existe.": "shared_message.el_contacto_no_existe",
  "La liquidación ya no existe.": "shared_message.la_liquidacion_ya_no_existe",
  "El movimiento ya no existe. Recarga los datos.": "shared_message.el_movimiento_ya_no_existe_recarga_los_datos",
  "Edita el traspaso como una operación completa.": "shared_message.edita_el_traspaso_como_una_operacion_completa",
  "La liquidación de principal se gestiona desde Deudas.": "shared_message.la_liquidacion_de_principal_se_gestiona_desde_deudas",
  "Edita el reintegro desde su liquidación.": "shared_message.edita_el_reintegro_desde_su_liquidacion",
  "Revisa y migra el gasto histórico antes de editarlo.": "shared_message.revisa_y_migra_el_gasto_historico_antes_de_editarlo",
  "La cartera del movimiento periódico debe existir.": "shared_message.la_cartera_del_movimiento_periodico_debe_existir",
  "La cartera del gasto debe existir.": "shared_message.la_cartera_del_gasto_debe_existir",
  "El gasto tiene liquidaciones: corrige explícitamente los cobros antes de modificar su reparto.": "shared_message.el_gasto_tiene_liquidaciones_corrige_explicitamente_los_cobros_antes_de_modificar_su",
  "Revisa y migra el gasto histórico antes de corregir la deuda.": "shared_message.revisa_y_migra_el_gasto_historico_antes_de_corregir_la_deuda",
  "El participante no existe.": "shared_message.el_participante_no_existe",
  "Las deudas superan el importe total pagado.": "shared_message.las_deudas_superan_el_importe_total_pagado",
  "Revisa y migra el gasto compartido histórico antes de modificarlo.": "shared_message.revisa_y_migra_el_gasto_compartido_historico_antes_de_modificarlo",
  "No se puede retirar la relación del gasto compartido.": "shared_message.no_se_puede_retirar_la_relacion_del_gasto_compartido",
  "El gasto tiene liquidaciones: elimina o corrige explícitamente los cobros antes de cambiar importe, participantes, fecha, categoría, cartera o borrar el gasto.": "shared_message.el_gasto_tiene_liquidaciones_elimina_o_corrige_explicitamente_los_cobros_antes_de",
  "El contacto tiene gastos vinculados y no puede eliminarse.": "shared_message.el_contacto_tiene_gastos_vinculados_y_no_puede_eliminarse",
  "Revisa los gastos compartidos históricos antes de renombrar o eliminar la cartera.": "shared_message.revisa_los_gastos_compartidos_historicos_antes_de_renombrar_o_eliminar_la_cartera",
  "reparto, tipo o cartera no verificables": "shared_message.reparto_tipo_o_cartera_no_verificables",
  "participante sin contacto estable": "shared_message.participante_sin_contacto_estable",
  "referencia a cobro en deuda no saldada": "shared_message.referencia_a_cobro_en_deuda_no_saldada",
  "pago sin movimiento inequívoco; una marca de pagado no demuestra un cobro ni una compensación": "shared_message.pago_sin_movimiento_inequivoco_una_marca_de_pagado_no_demuestra_un_cobro",
  "El total debe ser positivo y expresado en céntimos exactos.": "shared_message.el_total_debe_ser_positivo_y_expresado_en_centimos_exactos",
  "Los pesos deben ser no negativos, como máximo 1.000.000 y tener hasta seis decimales.": "shared_message.los_pesos_deben_ser_no_negativos_como_maximo_1_000_000_y",
  "Selecciona al menos otro contacto.": "shared_message.selecciona_al_menos_otro_contacto",
  "La suma de los pesos debe ser mayor que cero.": "shared_message.la_suma_de_los_pesos_debe_ser_mayor_que_cero",
  "Los importes individuales deben ser no negativos y tener como máximo dos decimales.": "shared_message.los_importes_individuales_deben_ser_no_negativos_y_tener_como_maximo_dos",
  "Los importes asignados superan el total pagado.": "shared_message.los_importes_asignados_superan_el_total_pagado",
  "Modalidad de reparto inválida.": "shared_message.modalidad_de_reparto_invalida",
  "Metadatos de reparto no reconocidos o incompletos.": "shared_message.metadatos_de_reparto_no_reconocidos_o_incompletos",
  "Faltan pesos de participantes.": "shared_message.faltan_pesos_de_participantes",
  "Peso de contacto inválido.": "shared_message.peso_de_contacto_invalido",
  "Los pesos deben corresponder a los contactos y su orden estable.": "shared_message.los_pesos_deben_corresponder_a_los_contactos_y_su_orden_estable",
  "La modalidad y los importes guardados no coinciden.": "shared_message.la_modalidad_y_los_importes_guardados_no_coinciden",
  "requiere revisión": "shared_message.requiere_revision"
} as const;
export function sharedOwnedText(value:string,t:typeof translate,depth=0):string{
 if(Object.hasOwn(keys,value))return t(keys[value as keyof typeof keys]);
 if(depth>8)return value;
 const issue=/^([\s\S]+): ([\s\S]+)\. Se conserva sin migrar\.$/.exec(value);
 if(issue)return t('shared_message.legacyIssue',{id:issue[1],reason:sharedOwnedText(issue[2],t,depth+1)});
 return bankingOwnedText(value,t);
}
