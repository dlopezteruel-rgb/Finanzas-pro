# Fase 5F — Resultados de laboratorio

Base `540cfcf269024e3b0d3399b653a2d5b16b1845c5`; frontend probado `d11c41f752be8641002fdd279dc577ffe70e4a83`. Tres muestras por escenario, mediana [mín–máx]. Node24.22.1 / Chromium156.0.8078.79; Linux3CPU AMD EPYC9V74, memoria10.452.459.520 bytes. Producción con gzip, ejecución secuencial sin otros navegadores locales. No son dispositivos físicos.

Perfiles: mobile390×900/CPU4×/80ms/1,6Mbps; tablet768×900/CPU2×/40ms/5Mbps; desktop1280×900/CPU1×/20ms/10Mbps. fast-mobile añade390/CPU4×/80ms/5Mbps para precarga; no sustituye al móvil limitado.

Las categorías CDP pueden solaparse. Heap es memoria JS viva aproximada sin GC forzado, no RSS. Los tiempos incluyen automatización y dos frames; no son INP de campo. Tres muestras y solapamiento descriptivo no constituyen inferencia estadística. Las diferencias pequeñas o con rangos solapados no se presentan como mejora confirmada.

## Escenarios generales

Son144observaciones por revisión:16escenarios×3perfiles×3muestras. Los datos y totales completos están listos antes de la primera página; la señal DOM es5.000filas antes y50después. La visibilidad real de la primera fila se mide además en el recorrido posterior.

| Perfil/escenario | Antes,ms | Después,ms | Cambio mediana |
| --- | ---: | ---: | ---: |
| mobile/landing-es-cold | 1,702.69 [1,525.76–1,767.41] | 1,580.90 [1,574.76–1,595.29] | -7.15% |
| mobile/landing-en-cold | 2,250.45 [2,211.04–2,275.06] | 2,246.32 [2,165.79–2,375.56] | -0.18% |
| mobile/application-empty-cold | 2,672.79 [2,528.54–2,753.84] | 2,710.57 [2,692.34–2,755.13] | +1.41% |
| mobile/application-cold | 2,761.71 [2,711.40–2,814.66] | 2,722.95 [2,691.29–2,741.74] | -1.40% |
| mobile/application-warm | 732.91 [731.58–774.35] | 744.63 [733.45–855.96] | +1.60% |
| mobile/chart-first-open | 561.40 [550.32–592.51] | 622.59 [544.49–699.30] | +10.90% |
| mobile/planning-first-open | 695.31 [636.61–1,056.33] | 781.99 [779.33–1,080.34] | +12.47% |
| mobile/catalog-first-open | 1,049.73 [1,019.93–1,052.22] | 1,094.30 [1,023.56–1,103.72] | +4.25% |
| mobile/ledger-100-first-open | 744.07 [708.00–814.55] | 883.10 [805.93–951.00] | +18.69% |
| mobile/ledger-100-filter | 267.65 [222.67–281.99] | 286.98 [254.63–299.38] | +7.22% |
| mobile/language-first-fr | 753.57 [622.36–784.32] | 702.38 [594.88–774.26] | -6.79% |
| mobile/language-cached-es | 177.27 [159.46–242.20] | 169.87 [154.97–199.79] | -4.18% |
| mobile/ledger-1000-first-open | 5,809.41 [5,784.47–6,333.25] | 620.35 [591.58–627.61] | -89.32% |
| mobile/ledger-1000-filter | 774.43 [728.36–779.84] | 676.47 [645.55–721.15] | -12.65% |
| mobile/ledger-5000-first-open | 26,587.94 [26,278.53–29,507.90] | 967.18 [939.74–1,047.50] | -96.36% |
| mobile/ledger-5000-filter | 2,801.70 [2,793.44–3,569.74] | 528.59 [483.73–699.12] | -81.13% |
| tablet/landing-es-cold | 712.39 [672.13–718.79] | 696.11 [631.79–712.97] | -2.28% |
| tablet/landing-en-cold | 882.69 [711.53–956.57] | 823.63 [782.54–837.33] | -6.69% |
| tablet/application-empty-cold | 1,107.69 [987.09–1,342.59] | 1,381.06 [1,045.39–1,395.45] | +24.68% |
| tablet/application-cold | 1,048.13 [1,041.88–1,439.58] | 1,374.39 [1,010.89–1,428.96] | +31.13% |
| tablet/application-warm | 531.76 [517.85–606.95] | 540.96 [534.83–549.59] | +1.73% |
| tablet/chart-first-open | 869.44 [856.99–884.91] | 863.73 [848.67–864.73] | -0.66% |
| tablet/planning-first-open | 482.45 [462.84–505.23] | 482.09 [450.41–519.03] | -0.08% |
| tablet/catalog-first-open | 550.48 [518.28–874.44] | 561.45 [533.34–632.28] | +1.99% |
| tablet/ledger-100-first-open | 334.23 [298.60–482.71] | 402.30 [288.73–448.43] | +20.37% |
| tablet/ledger-100-filter | 134.07 [119.24–150.90] | 131.43 [115.79–151.45] | -1.97% |
| tablet/language-first-fr | 314.94 [314.88–353.63] | 321.49 [298.36–336.42] | +2.08% |
| tablet/language-cached-es | 67.28 [66.42–78.96] | 101.73 [99.66–116.71] | +51.20% |
| tablet/ledger-1000-first-open | 2,251.46 [2,216.43–2,349.15] | 309.46 [267.03–339.18] | -86.26% |
| tablet/ledger-1000-filter | 432.24 [339.39–446.37] | 275.71 [235.42–327.93] | -36.21% |
| tablet/ledger-5000-first-open | 11,989.67 [11,887.95–12,037.64] | 527.82 [476.85–532.24] | -95.60% |
| tablet/ledger-5000-filter | 1,726.56 [1,503.89–1,778.28] | 297.64 [264.55–306.38] | -82.76% |
| desktop/landing-es-cold | 383.66 [379.59–428.54] | 446.02 [433.39–529.65] | +16.25% |
| desktop/landing-en-cold | 482.98 [453.56–606.74] | 450.35 [447.69–485.73] | -6.76% |
| desktop/application-empty-cold | 787.82 [648.50–792.18] | 710.08 [645.63–714.43] | -9.87% |
| desktop/application-cold | 702.95 [682.77–735.60] | 670.80 [660.76–740.16] | -4.57% |
| desktop/application-warm | 450.19 [418.97–480.75] | 432.74 [430.62–445.25] | -3.88% |
| desktop/chart-first-open | 847.77 [832.30–850.10] | 832.08 [830.44–850.33] | -1.85% |
| desktop/planning-first-open | 848.51 [396.41–901.62] | 846.62 [449.85–849.73] | -0.22% |
| desktop/catalog-first-open | 850.23 [416.09–852.72] | 854.23 [851.60–867.44] | +0.47% |
| desktop/ledger-100-first-open | 167.34 [165.75–281.08] | 167.28 [164.97–214.15] | -0.04% |
| desktop/ledger-100-filter | 66.51 [66.20–84.38] | 66.82 [66.65–83.69] | +0.47% |
| desktop/language-first-fr | 167.42 [165.66–167.42] | 183.66 [170.47–183.70] | +9.70% |
| desktop/language-cached-es | 50.07 [50.04–50.29] | 49.79 [47.43–66.57] | -0.56% |
| desktop/ledger-1000-first-open | 969.81 [941.86–1,112.03] | 150.38 [147.54–157.48] | -84.49% |
| desktop/ledger-1000-filter | 168.47 [162.52–303.30] | 147.52 [126.34–188.94] | -12.43% |
| desktop/ledger-5000-first-open | 4,962.20 [4,731.41–5,206.89] | 211.74 [210.19–334.04] | -95.73% |
| desktop/ledger-5000-filter | 694.41 [682.71–733.41] | 135.74 [135.30–149.72] | -80.45% |

## Interacciones con5.000movimientos

81observaciones por revisión:9escenarios×3perfiles×3muestras. La edición final es una acción financiera explícita sobre fixture ficticia: solo concepto y normalización preexistente de notas vacías. Se compara íntegramente el documento; únicamente exportedAt regenerado se normaliza tras validar su fecha ISO. El resto son acciones visuales con0escrituras y bytes almacenados idénticos.

| Perfil/escenario | Antes,ms | Después,ms | Rangos solapados |
| --- | ---: | ---: | --- |
| mobile/open-5000 | 28,019.45 [27,766.92–30,465.41] | 697.74 [596.09–743.89] | No |
| mobile/scroll-20-frames | 843.49 [761.07–860.24] | 350.17 [348.24–355.27] | No |
| mobile/theme-5000 | 37,058.48 [34,986.97–40,633.12] | 654.48 [538.08–824.20] | No |
| mobile/language-5000-fr | 22,760.58 [21,899.45–25,779.35] | 945.89 [944.97–973.35] | No |
| mobile/period-5000 | 3,582.76 [3,190.02–3,901.98] | 260.88 [254.34–297.11] | No |
| mobile/month-5000 | 11,046.98 [10,777.99–11,068.62] | 565.30 [562.07–598.69] | No |
| mobile/search-off-page | 2,304.22 [1,995.99–2,706.20] | 115.11 [114.58–127.61] | No |
| mobile/edit-dialog-open | 309.60 [302.78–365.58] | 260.85 [257.36–278.17] | No |
| mobile/edit-save-5000 | 1,417.04 [1,329.91–1,502.70] | 1,450.47 [1,409.00–1,502.35] | Sí |
| tablet/open-5000 | 11,750.12 [10,282.80–12,065.63] | 315.54 [300.76–331.60] | No |
| tablet/scroll-20-frames | 2,567.26 [2,178.53–2,619.75] | 346.53 [342.79–357.71] | No |
| tablet/theme-5000 | 16,194.88 [15,882.87–17,042.81] | 345.29 [289.64–361.38] | No |
| tablet/language-5000-fr | 12,020.06 [9,847.95–12,349.18] | 412.68 [405.35–426.40] | No |
| tablet/period-5000 | 1,560.04 [1,470.27–1,635.57] | 152.33 [126.63–170.67] | No |
| tablet/month-5000 | 4,914.80 [4,596.11–4,968.71] | 292.99 [261.29–293.36] | No |
| tablet/search-off-page | 1,079.86 [975.33–1,483.24] | 65.22 [64.46–68.33] | No |
| tablet/edit-dialog-open | 173.40 [169.99–327.83] | 137.45 [119.14–147.11] | No |
| tablet/edit-save-5000 | 798.11 [785.05–1,179.93] | 717.80 [695.85–721.40] | No |
| desktop/open-5000 | 4,698.89 [4,341.74–5,066.90] | 194.64 [181.49–215.20] | No |
| desktop/scroll-20-frames | 1,024.31 [826.81–1,052.58] | 360.36 [356.72–362.96] | No |
| desktop/theme-5000 | 6,462.20 [6,080.03–6,478.93] | 175.89 [161.01–194.99] | No |
| desktop/language-5000-fr | 4,955.23 [4,365.71–4,960.74] | 231.82 [231.76–251.13] | No |
| desktop/period-5000 | 753.51 [640.68–795.74] | 77.42 [59.57–93.51] | No |
| desktop/month-5000 | 2,942.26 [2,669.99–3,226.21] | 174.35 [153.97–176.88] | No |
| desktop/search-off-page | 492.00 [447.79–498.74] | 49.10 [48.51–49.48] | No |
| desktop/edit-dialog-open | 138.90 [101.04–145.55] | 97.52 [91.77–128.04] | Sí |
| desktop/edit-save-5000 | 413.81 [406.30–452.53] | 400.48 [390.27–411.94] | Sí |

### Apertura útil, datos completos y memoria

| Perfil | Entrada→fila visible antes/después,ms | Clic→fila visible antes/después,ms | Filas DOM antes/después | Heap aproximado antes/después,bytes |
| --- | --- | --- | --- | --- |
| mobile | 30,551.76 [30,360.77–32,785.23] / 3,764.76 [3,531.14–3,931.67] | 28,019.45 [27,766.92–30,465.41] / 697.74 [596.09–743.89] | 5.000 /50 | 68,046,672.00 [68,045,152.00–68,050,764.00] / 11,302,472.00 [11,222,344.00–11,323,872.00] |
| tablet | 12,974.73 [11,372.09–13,611.88] / 1,743.79 [1,444.72–1,871.77] | 11,750.12 [10,282.80–12,065.63] / 315.54 [300.76–331.60] | 5.000 /50 | 66,501,908.00 [66,498,112.00–68,047,016.00] / 11,296,592.00 [11,107,360.00–12,044,208.00] |
| desktop | 5,253.05 [5,094.40–5,644.30] / 905.51 [817.16–998.49] | 4,698.89 [4,341.74–5,066.90] / 194.64 [181.49–215.20] | 5.000 /50 | 68,736,268.00 [67,009,156.00–68,755,244.00] / 11,515,268.00 [11,142,184.00–12,261,264.00] |

El desplazamiento20×100px registra20intervalos rAF por muestra en el JSON. No se equipara a desplazamiento físico ni suavidad de todos los registros; en paginación se combina con cambio de página. No queda filtrado/contabilización diferida tras la primera presentación.

## Precarga con intención equivalente

72observaciones antes (cold/intent);144después (cold/intent/saveData/disabled). Misma anticipación nominal500ms en ambos lados y timers/idle nativos; la anticipación real incluye automatización y está retenida. Se publican clic→contenido e intención→contenido para no ocultar espera. Comprobación inicial:0peticiones de los tres destinos antes de señal válida.

| Perfil/módulo | Precargó,n/3 | Clic→contenido antes,ms | Clic→contenido después,ms | Intención→contenido antes,ms | Intención→contenido después,ms | Gzip adelantado,bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mobile/planning/intent | 0/3 | 652.36 [613.62–1,084.04] | 635.40 [634.31–651.69] | 1,284.40 [1,255.27–1,684.11] | 1,269.59 [1,236.23–1,270.57] | 0 |
| mobile/catalog/intent | 0/3 | 849.05 [779.57–981.61] | 922.47 [767.62–1,026.57] | 1,471.15 [1,381.85–1,618.19] | 1,523.19 [1,365.20–1,614.74] | 0 |
| mobile/assistant/intent | 0/3 | 468.89 [468.11–590.91] | 494.70 [466.16–506.60] | 1,100.22 [1,083.81–1,190.96] | 1,134.54 [1,081.25–1,139.75] | 0 |
| tablet/planning/intent | 3/3 | 453.16 [449.47–474.12] | 233.85 [233.09–257.68] | 1,018.28 [1,018.19–1,046.39] | 801.16 [800.45–809.37] | 12090 |
| tablet/catalog/intent | 3/3 | 583.99 [520.55–887.12] | 332.75 [317.77–333.96] | 1,145.34 [1,070.88–1,448.42] | 879.35 [868.03–883.68] | 8174 |
| tablet/assistant/intent | 3/3 | 866.20 [865.80–869.51] | 171.66 [134.44–178.85] | 1,434.41 [1,432.76–1,452.09] | 723.00 [685.72–743.76] | 4968 |
| desktop/planning/intent | 3/3 | 434.03 [400.19–847.09] | 134.59 [133.53–150.64] | 966.83 [933.95–1,382.73] | 667.74 [667.01–684.05] | 12090 |
| desktop/catalog/intent | 3/3 | 850.91 [850.14–855.27] | 199.51 [184.85–200.23] | 1,383.99 [1,383.29–1,403.19] | 733.39 [712.71–734.11] | 8174 |
| desktop/assistant/intent | 3/3 | 851.99 [365.90–852.77] | 84.31 [84.23–99.75] | 1,384.66 [899.96–1,386.05] | 617.91 [616.90–650.26] | 4968 |
| fast-mobile/planning/intent | 3/3 | 829.92 [601.96–980.70] | 502.16 [472.48–533.53] | 1,599.09 [1,218.26–1,603.49] | 1,135.88 [1,124.08–1,144.55] | 12090 |
| fast-mobile/catalog/intent | 3/3 | 982.44 [833.64–1,010.83] | 791.54 [644.69–840.76] | 1,603.20 [1,453.05–1,650.98] | 1,391.54 [1,248.03–1,456.40] | 8174 |
| fast-mobile/assistant/intent | 3/3 | 487.95 [470.44–516.74] | 238.62 [229.39–265.36] | 1,118.83 [1,070.23–1,130.05] | 849.03 [845.62–906.30] | 4968 |

### Primera y segunda apertura sin anticipación

| Perfil/módulo | Primera antes,ms | Primera después,ms | Segunda antes,ms | Segunda después,ms |
| --- | ---: | ---: | ---: | ---: |
| mobile/planning/cold | 627.77 [619.59–681.31] | 631.38 [617.80–1,089.55] | 424.92 [384.84–431.74] | 466.89 [454.68–511.05] |
| mobile/catalog/cold | 1,009.69 [984.66–1,080.00] | 1,074.27 [1,060.49–1,207.62] | 792.61 [623.66–875.28] | 808.50 [805.35–839.56] |
| mobile/assistant/cold | 497.59 [485.89–506.71] | 518.93 [502.42–536.67] | 188.90 [170.71–235.06] | 185.32 [168.92–208.11] |
| tablet/planning/cold | 452.01 [439.40–481.75] | 478.63 [434.26–502.03] | 211.96 [202.73–352.04] | 223.11 [188.58–261.63] |
| tablet/catalog/cold | 551.30 [516.01–589.74] | 555.92 [509.41–556.18] | 393.72 [381.98–403.89] | 372.80 [370.83–430.57] |
| tablet/assistant/cold | 882.37 [866.08–898.91] | 884.81 [402.00–910.80] | 117.50 [87.14–141.85] | 88.25 [87.91–92.45] |
| desktop/planning/cold | 849.54 [415.01–865.43] | 849.96 [849.27–881.56] | 110.52 [109.67–142.02] | 141.29 [108.51–142.64] |
| desktop/catalog/cold | 851.09 [850.67–866.32] | 852.08 [468.72–867.13] | 175.82 [170.21–187.36] | 195.78 [151.20–207.61] |
| desktop/assistant/cold | 851.04 [850.36–866.32] | 850.54 [833.29–851.87] | 78.95 [75.97–79.24] | 81.33 [78.71–85.12] |
| fast-mobile/planning/cold | 700.59 [590.81–736.23] | 715.39 [685.30–989.21] | 374.61 [347.29–405.66] | 414.85 [380.10–417.26] |
| fast-mobile/catalog/cold | 819.04 [742.91–1,212.43] | 820.46 [763.58–917.67] | 831.50 [668.36–858.04] | 737.85 [715.05–849.87] |
| fast-mobile/assistant/cold | 467.39 [453.26–521.38] | 501.06 [468.55–521.31] | 201.88 [158.25–320.17] | 164.16 [161.15–182.47] |

### Coste del intervalo de precarga

| Perfil/módulo | Script del intervalo antes/después,ms | Heap primera apertura antes/después,bytes | JS total primera apertura antes/después,bytes gzip |
| --- | --- | --- | --- |
| mobile/planning/intent | 0.49 [0.18–1.66] / 3.39 [3.29–4.15] | 7,468,572.00 [7,439,332.00–7,523,784.00] / 7,646,956.00 [7,614,840.00–7,726,192.00] | 257,441.00 [257,441.00–257,441.00] / 260,286.00 [260,286.00–260,286.00] |
| mobile/catalog/intent | 0.63 [0.12–1.75] / 1.07 [0.90–1.70] | 9,465,960.00 [9,430,872.00–9,512,056.00] / 9,601,296.00 [9,568,016.00–9,941,240.00] | 265,617.00 [265,617.00–265,617.00] / 268,460.00 [268,460.00–268,460.00] |
| mobile/assistant/intent | 0.53 [0.09–0.72] / 3.70 [2.60–4.68] | 6,430,084.00 [6,420,704.00–6,434,208.00] / 6,504,704.00 [6,461,620.00–6,508,208.00] | 250,323.00 [250,323.00–250,323.00] / 253,164.00 [253,164.00–253,164.00] |
| tablet/planning/intent | 0.86 [0.84–1.17] / 5.70 [4.86–7.61] | 6,815,640.00 [6,795,280.00–6,843,704.00] / 6,849,100.00 [6,829,120.00–6,969,344.00] | 257,441.00 [257,441.00–257,441.00] / 260,286.00 [260,286.00–260,286.00] |
| tablet/catalog/intent | 0.38 [0.34–0.81] / 5.21 [4.29–6.36] | 10,193,348.00 [10,057,764.00–11,533,740.00] / 8,722,952.00 [8,706,564.00–8,770,096.00] | 265,617.00 [265,617.00–265,617.00] / 268,460.00 [268,460.00–268,460.00] |
| tablet/assistant/intent | 1.39 [1.16–1.54] / 6.24 [5.59–16.99] | 5,672,148.00 [5,563,416.00–5,683,740.00] / 7,063,112.00 [5,633,560.00–7,160,668.00] | 250,323.00 [250,323.00–250,323.00] / 253,164.00 [253,164.00–253,164.00] |
| desktop/planning/intent | 0.43 [0.39–0.65] / 3.45 [3.07–12.15] | 6,837,660.00 [6,759,412.00–6,861,480.00] / 6,850,532.00 [6,783,524.00–6,884,168.00] | 257,441.00 [257,441.00–257,441.00] / 260,286.00 [260,286.00–260,286.00] |
| desktop/catalog/intent | 0.28 [0.25–0.70] / 3.38 [3.34–4.14] | 10,274,188.00 [10,263,856.00–10,337,272.00] / 8,772,188.00 [8,763,116.00–8,777,132.00] | 265,617.00 [265,617.00–265,617.00] / 268,460.00 [268,460.00–268,460.00] |
| desktop/assistant/intent | 0.46 [0.45–0.55] / 2.58 [2.50–4.15] | 5,730,616.00 [5,635,708.00–5,736,032.00] / 7,118,768.00 [5,602,272.00–7,175,996.00] | 250,323.00 [250,323.00–250,323.00] / 253,164.00 [253,164.00–253,164.00] |
| fast-mobile/planning/intent | 1.20 [0.57–1.43] / 10.78 [10.55–12.09] | 7,422,260.00 [7,416,164.00–7,500,708.00] / 7,616,576.00 [7,562,416.00–7,658,832.00] | 257,441.00 [257,441.00–257,441.00] / 260,286.00 [260,286.00–260,286.00] |
| fast-mobile/catalog/intent | 0.56 [0.09–0.61] / 14.43 [11.98–14.81] | 9,452,652.00 [9,409,176.00–9,530,104.00] / 9,402,112.00 [9,370,524.00–9,466,900.00] | 265,617.00 [265,617.00–265,617.00] / 268,460.00 [268,460.00–268,460.00] |
| fast-mobile/assistant/intent | 0.11 [0.09–0.34] / 9.44 [8.69–11.16] | 6,401,284.00 [6,398,108.00–6,437,472.00] / 6,411,072.00 [6,402,396.00–6,416,716.00] | 250,323.00 [250,323.00–250,323.00] / 253,164.00 [253,164.00–253,164.00] |

### Políticas de seguridad,solo después

24grupos×3muestras=72casos:saveData y ausencia de APIs en4perfiles×3módulos. Todos0peticiones de precarga y0escrituras financieras. Navegación bajo demanda conserva carga/error/reintento. No se inventa una comparación antes para una política que no existía en la base. El perfil mobile1,6Mbps también bloqueó las9intenciones(0/9precargas) aunque fuera4g; tablet,desktop y fast-mobile precargaron9/9 cada uno.

La red total tras visitar el destino no se reduce: se adelantan12.090bytes de Planificación,8.174de Catálogo y4.968de Asistente. Si la intención no se consume, ese tráfico queda como coste acotado de una funcionalidad. Las peticiones import() ya iniciadas no son abortables.

## Datos recuperables

- [Base general](phase-5f-baseline-core.json), [después general](phase-5f-after-core.json), [comparación](phase-5f-core-comparison.json).
- [Intención antes,gzip](phase-5f-before-intent.json.gz), [después,gzip](phase-5f-after-intent.json.gz), [comparación/costes](phase-5f-intent-comparison.json).
- [Interacciones antes](phase-5f-before-interactions.json), [después](phase-5f-after-interactions.json), [comparación](phase-5f-interactions-comparison.json).

Descomprimir con gzip -dc; los datos son JSON íntegros, sin redondeos en las muestras originales.
