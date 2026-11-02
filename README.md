# Пленумы Верховного Суда (СССР и РФ)

Офлайн-приложение (PWA): поиск по действующим пленумам по тексту, дате и статьям УК.

## Структура
- `docs/` — само приложение (GitHub Pages публикует именно эту папку)
- `source/word/NN.docx` — исходные постановления
- `build/build_data.py` — превращает Word в `docs/data/plenums.js`

## Обновление базы
1. Положите новый файл в `source/word/` (например `93.docx`).
2. `pip install python-docx`, затем `python build/build_data.py`.
3. В `docs/sw.js` увеличьте версию `V` (plenums-v2 …), чтобы у пользователей обновился кэш.

## Публикация
Settings → Pages → Deploy from a branch → ветка `main`, папка `/docs`.
