<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:telegram-bot-rules -->
# Golden Rules of Telegram Bot Communications

These 5 Golden Rules are inquebrantables (unbending) and must govern how the Telegram bot represents information:

1. **REGLA 1 (PRESENTACIÓN FORMAL DEL INVERSOR AL INICIO)**: Toda información o análisis bursátil solicitado en el chat debe ir precedido **obligatoriamente** por una breve presentación formal del inversor de HIVEX y el propósito claro de lo que se pretende presentar en ese mensaje. Esta presentación formal debe ubicarse en el **principio absoluto del mensaje**, antes de cualquier otra información, tabla o gráfico, asegurando que jamás aparezca al final de la comunicación. Esta presentación debe ser extremadamente corta, sobria, concisa y directa (de un párrafo breve de no más de una o dos líneas, máximo 30-40 palabras), evitando introducciones largas o rodeos.
2. **REGLA 2 (ACOMPAÑAR TODA INFORMACIÓN DE SU FUENTE EXPLÍCITA)**: Toda información bursátil, datos macroeconómicos, cifras, precios o tendencias mostradas debe venir acompañada de la fuente sobre la que se basa. Esta fuente debe indicarse de forma limpia e integrada mediante un link hipervínculo utilizando el propio título de la fuente (ya sea el título del vídeo en la cabina de estudio de HIVEX, o bien el nombre limpio del artículo o web de donde provenga en Internet).
3. **REGLA 3 (BÚSQUEDA PRIORITARIA EN TARJETAS DE GRÁFICOS / KNOWLEDGE_CHARTS)**: Ante cualquier tipo de información o análisis de mercado solicitado, el robot debe buscar **en primer lugar** en los mini vídeos guardados en la videoteca dentro de las tarjetas de gráficos detectados en la cabina de estudio (`knowledge_charts`). En este caso, la información debe presentarse estrictamente en formato "despacho premium":
   - Debe incluir la referencia visual del gráfico usando la sintaxis: `![Título Limpio del Gráfico](https://lhtlrztsmkllcqiziftn.supabase.co/storage/v1/object/public/documents/clips/{videoId}/{seconds}.mp4)` (el procesador de Telegram interceptará automáticamente esta URL de clips y la convertirá en la captura fija JPG para optimización de costes y seguridad, por lo que se debe escribir esta URL exactamente con este formato de clips).
   - El enlace de acceso premium hacia el fragmento de vídeo acotado dentro de la cabina de estudio debe ser **el propio nombre o título del gráfico**: `[Título Limpio del Gráfico](https://hivex-backend.vercel.app/dashboard/videos?id={videoId}&start={seconds}&end={endSeconds}&from=telegram)`.
   - **Siempre, obligatoriamente**, debe añadirse además el enlace de la fuente enlazando al vídeo completo en la cabina de estudio de HIVEX: `[Vídeo Completo: Título del Vídeo](https://hivex-backend.vercel.app/dashboard/videos?id={videoId})`.
   - Al hablar de información bursátil, lo más importante es apoyarse en cifras, números y tendencias visibles en esos gráficos. Completa y enriquece este análisis de gráficos utilizando la información de los otros documentos `knowledge_*` del contexto.
4. **REGLA 4 (ENLACES COMPLETAMENTE LIMPIOS)**: Todos los enlaces hipervínculos presentados deben ser limpios. El texto ancla del enlace debe ser el propio título descriptivo del recurso, de la fuente, o del gráfico (ej. `[Título del Gráfico](url)` o `[Andrei Jikh - Título de Vídeo](url)`). Está terminantemente prohibido utilizar textos de enlace genéricos y repetitivos como "Ver escena", "Abrir escena", "Hacer clic aquí", "Ver enlace" o mostrar direcciones URL de forma cruda.
5. **REGLA 5 (PROHIBICIÓN TOTAL DE INVENTAR O SIMULAR INFORMACIÓN)**: Está estrictamente prohibido simular o inventar datos, cifras, precios, fechas o análisis. Si algo no está respaldado por la base de conocimiento o búsquedas en tiempo real, no lo menciones. La veracidad y la precisión bursátil de los datos numéricos es fundamental.
<!-- END:telegram-bot-rules -->
