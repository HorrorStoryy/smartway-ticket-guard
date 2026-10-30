# Smartway Ticket Guard

Автоматический чек-лист перед оплатой на сайтах партнеров Smartway.

## Что делает

При нажатии на кнопку оплаты ("Купить", "Оплатить", "Оформить билет") на сайтах партнеров автоматически появляется чек-лист из 6 пунктов. После отметки всех пунктов кнопка "ОПЛАТИТЬ" активируется и происходит переход к оплате.

## Поддерживаемые сайты

- e-traffic.ru
- avtovokzaly.ru
- tutu.ru
- aeroexpress.ru
- rfbus.ru
- avperm.ru
- krasavtovokzal.ru
- avtoperm.ru
- avtovokzal-irkutsk.ru
- unitiki.com
- ros-bilet.ru
- smarttravel.ru
- smart-mobility.ru
- aviasales.ru
- yandex.ru

## Установка

### Шаг 1. Установите Tampermonkey

- **Chrome**: [Tampermonkey для Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfko)
- **Яндекс Браузер**: [Tampermonkey для Яндекс](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfko)
- **Firefox**: [Tampermonkey для Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

### Шаг 2. Установите скрипт

Перейдите по ссылке: https://raw.githubusercontent.com/HorrorStoryy/smartway-ticket-guard/main/smartway-ticket-guard.user.js

Tampermonkey автоматически откроет окно установки. Нажмите **"Установить"**.

## Использование

1. Откройте сайт партнера (например, tutu.ru или avtovokzaly.ru)
2. Заполните форму заказа
3. Нажмите кнопку оплаты ("Купить", "Оплатить", "Оформить билет")
4. Отметьте все 6 пунктов чек-листа:
   - ✅ Дата поездки
   - ✅ Время поездки
   - ✅ Город отправления и адрес
   - ✅ Город прибытия и адрес
   - ✅ ФИО и паспорт пассажира
   - ✅ Наличие багажа
5. Нажмите **"ОПЛАТИТЬ"** — кнопка активируется только после отметки всех пунктов

## Как это работает

1. Скрипт отслеживает клики по кнопкам на сайтах из списка TARGETS
2. При клике на кнопку оплаты проверяет, является ли страница финальной стадией оформления (есть поля ввода ФИО/паспорта, маркеры "пассажир"/"фамилия" и т.д.)
3. Если да — показывает чек-лист и блокирует оригинальный клик
4. После подтверждения чек-листа эмулирует клик по оригинальной кнопке (поддерживает классические формы, React/Vue сайты, jQuery)


