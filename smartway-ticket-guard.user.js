// ==UserScript==
// @name         Smartway Ticket Guard
// @namespace    https://smartway.today/
// @version      2.6
// @description  Предохранитель для проверки данных перед покупкой билетов + Alt+C
// @author       Smartway
// @match        https://*/*
// @match        http://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/HorrorStoryy/smartway-ticket-guard/main/smartway-ticket-guard.meta.js
// @downloadURL  https://raw.githubusercontent.com/HorrorStoryy/smartway-ticket-guard/main/smartway-ticket-guard.user.js
// ==/UserScript==

(function() {
    'use strict';

    var ICON_CLOSE = '\u2715';

    var TARGETS = [
        { domain: 'e-traffic.ru', selector: ".btn-order, .btn-buy, button[type='submit'], .order-button" },
        { domain: 'avtovokzaly.ru', selector: ".btn-buy, .btn-success, .ticket-btn, .button-pay, .pay-btn, .js-buy-btn, [class*='buy-button'], [class*='pay-button'], .btn-pay, button" },
        { domain: 'tutu.ru', selector: ".order-button, button.b-button, [class*='SubmitButton']" },
        { domain: 'aeroexpress.ru', selector: "button[type='submit'], .buy-button, [class*='button']" },
        { domain: 'rfbus.ru', selector: ".btn-booking, .btn-pay, [class*='submit'], .button-booking" },
        { domain: 'avperm.ru', selector: ".btn-buy, .btn-primary, button[type='submit'], .js-buy-ticket, .buy-btn, .btn-order, .js-order-btn, .button, a" },
        { domain: 'krasavtovokzal.ru', selector: ".btn, button, .js-buy, .order-btn, .js-order-ticket" },
        { domain: 'avtoperm.ru', selector: ".btn-buy, .btn-primary, button[type='submit']" },
        { domain: 'avtovokzal-irkutsk.ru', selector: ".btn-buy, #buy-btn, button" },
        { domain: 'unitiki.com', selector: "button, [type='submit'], .btn-pay, .submit-button" },
        { domain: 'ros-bilet.ru', selector: ".btn, button, .buy-btn, [class*='pay'], .pay-btn" },
        { domain: 'smarttravel.ru', selector: "button, .v-btn, .btn-primary, .btn, [role='button']" },
        { domain: 'smart-mobility.ru', selector: "button, .v-btn, .btn-order, .btn-primary, [role='button']" },
        { domain: 'aviasales.ru', selector: "[data-test-id='button']" },
        { domain: 'yandex.ru', selector: ".Button_purchase" }
    ];

    var KEYWORDS = [
        'оформить билет', 'оформить', 'оплатить', 'купить', 'забронировать',
        'далее', 'подтвердить', 'pay', 'order', 'продолжить', 'бронировать',
        'купить за', 'оплатить картой', 'перейти к оплате'
    ];

    var MONTH_MAP = {
        'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'мая': '05',
        'июн': '06', 'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
    };

    var isInternalClick = false;
    var appState = { hasData: false, widgetVisible: false };

    function updateLocalState(data) {
        if (data.referenceData !== undefined) {
            appState.hasData = !!data.referenceData && data.referenceData.trim().length > 0;
        }
        if (data.widgetVisible !== undefined) {
            appState.widgetVisible = !!data.widgetVisible;
        }
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function enrichTextWithFormattedDates(text) {
        if (!text) return '';
        var dateRegex = /(\d{1,2})[\s.]([а-яёА-ЯЁ]{3,})[\s.](\d{4})(?:\sг.?)?/g;
        return text.replace(dateRegex, function(match, day, month, year) {
            var monthLower = month.toLowerCase();
            var monthNum = MONTH_MAP[monthLower];
            if (!monthNum) {
                var keys = Object.keys(MONTH_MAP);
                for (var i = 0; i < keys.length; i++) {
                    if (monthLower.indexOf(keys[i]) === 0) {
                        monthNum = MONTH_MAP[keys[i]];
                        break;
                    }
                }
            }
            if (monthNum) {
                var dayFormatted = day.length === 1 ? '0' + day : day;
                return match + ' (' + dayFormatted + '.' + monthNum + '.' + year + ')';
            }
            return match;
        });
    }

    function isFinalCheckoutStage(buttonText, hostname) {
        var url = window.location.href.toLowerCase();
        var pageText = (document.body.innerText || '').toLowerCase();
        var btnLower = buttonText.toLowerCase();

        var passwordInputs = document.querySelectorAll('input[type="password"]');
        var hasVisiblePassword = false;
        for (var i = 0; i < passwordInputs.length; i++) {
            if (passwordInputs[i].offsetParent !== null || passwordInputs[i].offsetWidth > 0) {
                hasVisiblePassword = true; break;
            }
        }
        if (hasVisiblePassword) return false;

        if (hostname.indexOf('smart-mobility.ru') !== -1 || hostname.indexOf('smarttravel.ru') !== -1) {
            var isAction = false;
            for (var k = 0; k < KEYWORDS.length; k++) {
                if (btnLower.indexOf(KEYWORDS[k]) !== -1) { isAction = true; break; }
            }
            if (isAction) return true;
        }

        var isSearchPage = url.indexOf('/search') !== -1 || url.indexOf('/results') !== -1 ||
            url.indexOf('/rasp') !== -1 || url.indexOf('/shedule') !== -1 || url.indexOf('/selection') !== -1;
        if (isSearchPage) return false;

        var criticalSelectors = [
            'input[name*="surname"]', 'input[name*="lastname"]', 'input[name*="fio"]',
            'input[placeholder*="Фамилия"]', 'input[placeholder*="Имя"]', 'input[placeholder*="Паспорт"]',
            'input[placeholder*="Документ"]', 'input[aria-label*="Фамилия"]',
            'input[data-vv-name*="passenger"]', 'input[name*="passenger"]',
            'input[id*="pas"]', 'input[id*="doc"]', 'input[id*="passenger"]', 'input[name*="doc"]'
        ];

        var allCritical = document.querySelectorAll(criticalSelectors.join(', '));
        var hasVisibleInputs = false;
        for (var j = 0; j < allCritical.length; j++) {
            if (allCritical[j].offsetParent !== null || allCritical[j].offsetWidth > 0) {
                hasVisibleInputs = true; break;
            }
        }

        var markers = ['пассажир', 'фамилия', 'паспорт', 'номер документа', 'данные пассажира', 'сведения о пассажире'];
        var markersFound = 0;
        for (var m = 0; m < markers.length; m++) {
            if (pageText.indexOf(markers[m]) !== -1) markersFound++;
        }

        // ОРИГИНАЛЬНАЯ ЛОГИКА + небольшая подстраховка на случай изменения вёрстки сайта
        if (hostname.indexOf('avtovokzaly.ru') !== -1) {
            var isCheckoutPath = url.indexOf('checkout') !== -1 || url.indexOf('order') !== -1 ||
                url.indexOf('buy') !== -1 || url.indexOf('passenger') !== -1 || url.indexOf('ticket') !== -1;
            
            // Если вёрстка изменилась и hasVisibleInputs не срабатывает, но мы на странице оформления и кнопка говорит "купить" - показываем
            var isExplicitBuy = btnLower.indexOf('купить') !== -1 || btnLower.indexOf('оплатить') !== -1;
            
            var result = hasVisibleInputs || (isCheckoutPath && markersFound >= 1) || (isCheckoutPath && isExplicitBuy);
            console.log('[Ticket Guard] avtovokzaly.ru проверка:', { hasVisibleInputs: hasVisibleInputs, isCheckoutPath: isCheckoutPath, markersFound: markersFound, isExplicitBuy: isExplicitBuy, итог: result });
            return result;
        }

        if (hostname.indexOf('e-traffic.ru') !== -1) return hasVisibleInputs;
        if (hostname.indexOf('tutu.ru') !== -1) return hasVisibleInputs || markersFound >= 2;
        if (hostname.indexOf('avperm.ru') !== -1) {
            return btnLower.indexOf('купить билет') !== -1 || btnLower.indexOf('перейти к оплате') !== -1;
        }
        if (hostname.indexOf('unitiki.com') !== -1) {
            return btnLower.indexOf('купить билет') !== -1;
        }

        var isBookingUrl = url.indexOf('buy') !== -1 || url.indexOf('booking') !== -1 ||
            url.indexOf('order') !== -1 || url.indexOf('pay') !== -1 || url.indexOf('ticket') !== -1;
        return hasVisibleInputs || (isBookingUrl && markersFound >= 1);
    }

    function findPayButton(element) {
        if (!element || element === document) return null;
        var btn = element.closest("button, a, [role='button'], .v-btn, .btn, .button, .btn-pay, .ticket-btn, .button-pay, [class*='button'], [class*='btn']");
        if (!btn) return null;

        var text = (btn.innerText || btn.textContent || btn.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        var isMatch = false;
        for (var i = 0; i < KEYWORDS.length; i++) {
            if (text.indexOf(KEYWORDS[i]) !== -1) { isMatch = true; break; }
        }
        if (!isMatch && /купить\s+за/i.test(text)) isMatch = true;

        if (isMatch) {
            var href = btn.getAttribute('href');
            if (href && href.indexOf('#') !== 0 && href.indexOf('javascript:') !== 0 && !isFinalCheckoutStage(text, window.location.hostname)) {
                return null;
            }
            return btn;
        }
        return null;
    }

    function updateFloatingWidget(text, isVisible) {
        var widgetRoot = document.getElementById('smartway-info-root');
        if (!text || isVisible === false) {
            if (widgetRoot) widgetRoot.remove();
            return;
        }

        var enrichedText = enrichTextWithFormattedDates(text);

        if (!widgetRoot) {
            widgetRoot = document.createElement('div');
            widgetRoot.id = 'smartway-info-root';
            document.body.appendChild(widgetRoot);
            var shadow = widgetRoot.attachShadow({ mode: 'open' });

            var style = document.createElement('style');
            style.textContent =
                '.info-card {' +
                '  position: fixed; bottom: 20px; right: 20px; width: 360px;' +
                '  background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 14px;' +
                '  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); z-index: 2147483647;' +
                '  font-family: system-ui, -apple-system, sans-serif; border: 1px solid #334155;' +
                '}' +
                '.header { font-weight: 800; margin-bottom: 10px; color: #38bdf8; display: flex; justify-content: space-between; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }' +
                '.content {' +
                '  font-family: "JetBrains Mono", "Fira Code", monospace;' +
                '  background: #000000; padding: 12px; border-radius: 8px;' +
                '  max-height: 200px; overflow-y: auto; white-space: pre-wrap;' +
                '  font-size: 14px; color: #ffffff; border: 1px solid #1e293b; line-height: 1.6;' +
                '}' +
                '.date-tag { color: #facc15; font-weight: bold; text-decoration: underline; }' +
                '.close { cursor: pointer; opacity: 0.6; font-size: 18px; line-height: 1; padding: 0 5px; }' +
                '.close:hover { opacity: 1; color: #ef4444; }';

            var container = document.createElement('div');
            container.className = 'info-card';
            container.innerHTML = '<div class="header"><span>Справка клиента</span><span class="close" id="close-widget">' + ICON_CLOSE + '</span></div><div class="content" id="widget-text"></div>';

            shadow.appendChild(style);
            shadow.appendChild(container);

            shadow.getElementById('close-widget').onclick = function() {
                GM_setValue('widgetVisible', false);
                updateLocalState({ widgetVisible: false });
            };
        }

        var textElement = widgetRoot.shadowRoot.getElementById('widget-text');
        if (textElement) {
            var html = escapeHtml(enrichedText);
            html = html.replace(/\((\d{2}\.\d{2}\.\d{4})\)/g, '<span class="date-tag">($1)</span>');
            textElement.innerHTML = html;
        }
    }

    function showSafetyModal(originalElement) {
        if (document.getElementById('smartway-safety-root')) return;

        var data = GM_getValue('referenceData', '');
        var referenceText = enrichTextWithFormattedDates(data || 'ДАННЫЕ НЕ ЗАХВАЧЕНЫ');

        var root = document.createElement('div');
        root.id = 'smartway-safety-root';
        document.body.appendChild(root);

        var shadow = root.attachShadow({ mode: 'open' });

        var style = document.createElement('style');
        style.textContent =
            '.overlay {' +
            '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;' +
            '  background: transparent;' +
            '  display: flex; align-items: stretch; justify-content: flex-end;' +
            '  z-index: 2147483647; font-family: system-ui, sans-serif;' +
            '  pointer-events: none;' +
            '}' +
            '.modal {' +
            '  background: #ffffff; width: 450px; padding: 30px; height: 100vh;' +
            '  box-shadow: -10px 0 30px rgba(0,0,0,0.15); color: #1e293b;' +
            '  border-left: 1px solid #e2e8f0; box-sizing: border-box;' +
            '  display: flex; flex-direction: column; justify-content: space-between;' +
            '  animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);' +
            '  pointer-events: auto;' +
            '}' +
            '@keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }' +
            '.modal-scrollable { overflow-y: auto; flex-grow: 1; padding-right: 5px; margin-bottom: 20px; }' +
            'h2 { margin: 0 0 20px; font-size: 18px; text-transform: uppercase; color: #ef4444; font-weight: 900; text-align: center; }' +
            '.reference-box {' +
            '  background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px;' +
            '  padding: 16px; font-family: monospace; font-size: 14px; white-space: pre-wrap;' +
            '  margin-bottom: 20px; max-height: 200px; overflow-y: auto; color: #000000; line-height: 1.5;' +
            '}' +
            '.date-highlight { background: #fef9c3; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: bold; }' +
            '.checklist { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }' +
            '.check-item {' +
            '  display: flex; align-items: center; cursor: pointer;' +
            '  font-size: 14px; padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0;' +
            '  transition: background 0.15s;' +
            '}' +
            '.check-item:hover { background: #f1f5f9; }' +
            '.check-item.checked { border-color: #10b981; background: #f0fdf4; }' +
            '.check-item input { width: 20px; height: 20px; margin-right: 14px; cursor: pointer; accent-color: #10b981; }' +
            '.actions { display: flex; gap: 12px; margin-top: auto; }' +
            '.btn { flex: 1; padding: 14px; border-radius: 12px; border: none; font-weight: 800; cursor: pointer; font-size: 14px; text-transform: uppercase; transition: all 0.2s; }' +
            '.btn-pay { background: #10b981; color: #fff; }' +
            '.btn-pay:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }' +
            '.btn-cancel { background: #fff; border: 2px solid #e2e8f0; color: #64748b; }' +
            '.btn-cancel:hover { background: #f1f5f9; }';

        var container = document.createElement('div');
        container.className = 'overlay';

        var htmlContent = escapeHtml(referenceText);
        htmlContent = htmlContent.replace(/\((\d{2}\.\d{2}\.\d{4})\)/g, '<span class="date-highlight">($1)</span>');

        container.innerHTML =
            '<div class="modal">' +
            '  <div class="modal-scrollable">' +
            '    <h2>Сверка перед оплатой</h2>' +
            '    <div class="reference-box">' + htmlContent + '</div>' +
            '    <div class="checklist">' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>Дата поездки</span></label>' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>Время поездки</span></label>' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>Город отправления и адрес</span></label>' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>Город прибытия и адрес</span></label>' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>ФИО и паспорт пассажира</span></label>' +
            '      <label class="check-item"><input type="checkbox" class="safeguard"><span>Наличие багажа</span></label>' +
            '    </div>' +
            '  </div>' +
            '  <div class="actions">' +
            '    <button class="btn btn-cancel" id="cancel">Исправить</button>' +
            '    <button class="btn btn-pay" id="confirm" disabled>ОПЛАТИТЬ</button>' +
            '  </div>' +
            '</div>';

        shadow.appendChild(style);
        shadow.appendChild(container);

        var checkboxes = shadow.querySelectorAll('.safeguard');
        var confirmBtn = shadow.getElementById('confirm');
        var cancelBtn = shadow.getElementById('cancel');

        for (var i = 0; i < checkboxes.length; i++) {
            (function(cb) {
                cb.onchange = function() {
                    cb.closest('.check-item').classList.toggle('checked', cb.checked);
                    var allChecked = true;
                    for (var j = 0; j < checkboxes.length; j++) {
                        if (!checkboxes[j].checked) { allChecked = false; break; }
                    }
                    confirmBtn.disabled = !allChecked;
                };
            })(checkboxes[i]);
        }

        cancelBtn.onclick = function() { root.remove(); };

        // ===== УМНАЯ ОБРАБОТКА КЛИКА (РЕШЕНИЕ ПРОБЛЕМ С РОС-БИЛЕТОМ И ТУТУ) =====
        confirmBtn.onclick = function() {
            console.log('[Ticket Guard] Подтверждение оплаты');
            isInternalClick = true;

            var realBtn = originalElement.closest('button, a, input') || originalElement;
            console.log('[Ticket Guard] Целевой элемент:', realBtn.tagName, realBtn.className || '');

            // 1. Если кнопка внутри формы (как на ros-bilet.ru) - отправляем форму
            var form = realBtn.closest('form');
            if (form) {
                console.log('[Ticket Guard] Найдена форма, используем form.requestSubmit()');
                root.remove();
                setTimeout(function() {
                    if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit(realBtn); // Передаём кнопку как источник события
                    } else {
                        form.submit();
                    }
                }, 100);
                return;
            }

            // 2. Если это ссылка (как иногда бывает на некоторых сайтах)
            var href = realBtn.getAttribute('href');
            if (href && href.indexOf('#') !== 0 && href.indexOf('javascript:') !== 0) {
                console.log('[Ticket Guard] Найдена ссылка, переходим по href:', href);
                root.remove();
                setTimeout(function() {
                    window.location.href = href;
                }, 100);
                return;
            }

            // 3. Иначе эмулируем клик (для React/Vue сайтов типа tutu.ru)
            console.log('[Ticket Guard] Эмуляция клика через PointerEvent + MouseEvent');
            var triggerClick = function(el) {
                el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
                el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            };
            
            triggerClick(realBtn);
            isInternalClick = false;
            root.remove();
        };
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    var savedData = GM_getValue('referenceData', '');
    var savedVisible = GM_getValue('widgetVisible', true);
    console.log('[Ticket Guard] Загружено из хранилища:', { data: savedData ? 'есть (' + savedData.length + ' симв.)' : 'нет', visible: savedVisible });
    updateLocalState({ referenceData: savedData, widgetVisible: savedVisible });
    if (savedData) {
        updateFloatingWidget(savedData, savedVisible);
    }

    // Синхронизация между вкладками
    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('referenceData', function(name, old_value, new_value, remote) {
            console.log('[Ticket Guard] referenceData обновлён из другой вкладки');
            updateLocalState({ referenceData: new_value });
            var visible = GM_getValue('widgetVisible', true);
            updateFloatingWidget(new_value, visible);
        });
        GM_addValueChangeListener('widgetVisible', function(name, old_value, new_value, remote) {
            updateLocalState({ widgetVisible: new_value });
            var data = GM_getValue('referenceData', '');
            if (data) updateFloatingWidget(data, new_value);
        });
    }

    // Alt+C
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.code === 'KeyC') {
            var selection = window.getSelection().toString().trim();
            if (selection) {
                console.log('[Ticket Guard] Alt+C: сохранено', selection.length, 'символов');
                GM_setValue('referenceData', selection);
                GM_setValue('widgetVisible', true);
                updateLocalState({ referenceData: selection, widgetVisible: true });
                updateFloatingWidget(selection, true);
            }
        }
    });

    // Перехват кликов
    document.addEventListener('click', function(e) {
        if (isInternalClick) return;
        
        console.log('[Ticket Guard] appState:', appState);
        if (!appState.hasData || !appState.widgetVisible) return;

        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            var type = (e.target.type || '').toLowerCase();
            if (type !== 'submit' && type !== 'button' && type !== 'reset') return;
        }

        var currentHost = window.location.hostname;
        var targetConfig = null;
        for (var i = 0; i < TARGETS.length; i++) {
            if (currentHost.indexOf(TARGETS[i].domain) !== -1) {
                targetConfig = TARGETS[i];
                break;
            }
        }
        if (!targetConfig) return;

        var payButton = findPayButton(e.target);
        if (!payButton) {
            payButton = e.target.closest(targetConfig.selector);
        }

        if (payButton) {
            var btnText = (payButton.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
            console.log('[Ticket Guard] Найдена кнопка на', currentHost, ':', btnText);

            if (!isFinalCheckoutStage(btnText, currentHost)) {
                console.log('[Ticket Guard] isFinalCheckoutStage вернул false');
                return;
            }

            console.log('[Ticket Guard] Показываем чек-лист');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showSafetyModal(payButton);
        }
    }, true);

    console.log('[Smartway Ticket Guard v2.6] Загружен');

})();
