// ==UserScript==
// @name         Smartway Ticket Guard
// @namespace    https://smartway.today/
// @version      2.3
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
        { domain: 'tutu.ru', selector: ".order-button, button.b-button, [class*='SubmitButton'], .btn" },
        { domain: 'aeroexpress.ru', selector: "button[type='submit'], .buy-button, [class*='button'], .btn" },
        { domain: 'rfbus.ru', selector: ".btn-booking, .btn-pay, [class*='submit'], .button-booking, .btn" },
        { domain: 'avperm.ru', selector: ".btn-buy, .btn-primary, button[type='submit'], .js-buy-ticket, .buy-btn, .btn-order, .js-order-btn, .button, a, .btn" },
        { domain: 'krasavtovokzal.ru', selector: ".btn, button, .js-buy, .order-btn, .js-order-ticket" },
        { domain: 'avtoperm.ru', selector: ".btn-buy, .btn-primary, button[type='submit'], .btn" },
        { domain: 'avtovokzal-irkutsk.ru', selector: ".btn-buy, #buy-btn, button, .btn" },
        { domain: 'unitiki.com', selector: "button, [type='submit'], .btn-pay, .submit-button, .btn" },
        { domain: 'ros-bilet.ru', selector: ".btn, button, .buy-btn, [class*='pay'], .pay-btn" },
        { domain: 'smarttravel.ru', selector: "button, .v-btn, .btn-primary, .btn, [role='button']" },
        { domain: 'smart-mobility.ru', selector: "button, .v-btn, .btn-order, .btn-primary, [role='button']" },
        { domain: 'aviasales.ru', selector: "[data-test-id='button'], .btn" },
        { domain: 'yandex.ru', selector: ".Button_purchase, .btn" }
    ];

    var KEYWORDS = [
        'оформить билет', 'оформить', 'оплатить', 'купить', 'забронировать',
        'далее', 'подтвердить', 'pay', 'order', 'продолжить', 'бронировать',
        'купить за', 'оплатить картой', 'перейти к оплате', 'выбрать', 'оформить заказ'
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
        console.log('[Ticket Guard] Состояние:', appState);
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

    // УПРОЩЁННАЯ ЛОГИКА: для большинства сайтов достаточно ключевого слова
    function isFinalCheckoutStage(buttonText, hostname) {
        var url = window.location.href.toLowerCase();
        var pageText = (document.body.innerText || '').toLowerCase();
        var btnLower = buttonText.toLowerCase();

        // Проверка на поле пароля
        var passwordInputs = document.querySelectorAll('input[type="password"]');
        for (var i = 0; i < passwordInputs.length; i++) {
            if (passwordInputs[i].offsetParent !== null || passwordInputs[i].offsetWidth > 0) {
                return false;
            }
        }

        // Страницы поиска — не перехватываем
        var isSearchPage = url.indexOf('/search') !== -1 || url.indexOf('/results') !== -1 ||
            url.indexOf('/rasp') !== -1 || url.indexOf('/shedule') !== -1 || url.indexOf('/selection') !== -1;
        if (isSearchPage) return false;

        // Проверяем наличие ключевого слова в тексте кнопки
        var hasActionKeyword = false;
        for (var k = 0; k < KEYWORDS.length; k++) {
            if (btnLower.indexOf(KEYWORDS[k]) !== -1) {
                hasActionKeyword = true;
                break;
            }
        }

        // Для smart-mobility и smarttravel — показываем, если есть ключевое слово
        if (hostname.indexOf('smart-mobility.ru') !== -1 || hostname.indexOf('smarttravel.ru') !== -1) {
            return hasActionKeyword;
        }

        // Для e-traffic.ru — показываем, если есть ключевое слово
        if (hostname.indexOf('e-traffic.ru') !== -1) {
            return hasActionKeyword;
        }

        // Для tutu.ru — показываем, если есть ключевое слово
        if (hostname.indexOf('tutu.ru') !== -1) {
            return hasActionKeyword;
        }

        // Для avtovokzaly.ru — показываем, если есть ключевое слово или маркеры
        if (hostname.indexOf('avtovokzaly.ru') !== -1) {
            var markers = ['пассажир', 'фамилия', 'паспорт', 'номер документа', 'данные пассажира'];
            var markersFound = 0;
            for (var m = 0; m < markers.length; m++) {
                if (pageText.indexOf(markers[m]) !== -1) markersFound++;
            }
            return hasActionKeyword || markersFound >= 1;
        }

        // Для avperm.ru — показываем, если есть ключевое слово
        if (hostname.indexOf('avperm.ru') !== -1) {
            return hasActionKeyword;
        }

        // Для unitiki.com — показываем, если есть ключевое слово
        if (hostname.indexOf('unitiki.com') !== -1) {
            return hasActionKeyword;
        }

        // Для остальных — показываем, если есть ключевое слово
        return hasActionKeyword;
    }

    function findPayButton(element) {
        if (!element || element === document) return null;
        var btn = element.closest("button, a, [role='button'], .v-btn, .btn, .button, .btn-pay, .ticket-btn, .button-pay, [class*='button'], [class*='btn']");
        if (!btn) return null;

        var text = (btn.innerText || btn.textContent || btn.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        var isMatch = false;
        for (var i = 0; i < KEYWORDS.length; i++) {
            if (text.indexOf(KEYWORDS[i]) !== -1) {
                isMatch = true;
                break;
            }
        }
        if (!isMatch && /купить\s+за/i.test(text)) isMatch = true;

        if (isMatch) {
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
            widgetRoot.style.cssText = 'position:fixed;bottom:20px;right:20px;width:360px;background:#0f172a;color:#f8fafc;padding:16px;border-radius:14px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;border:1px solid #334155;';
            widgetRoot.innerHTML =
                '<div style="font-weight:800;margin-bottom:10px;color:#38bdf8;display:flex;justify-content:space-between;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">' +
                '<span>Справка клиента</span>' +
                '<span id="close-widget" style="cursor:pointer;opacity:0.6;font-size:18px;line-height:1;padding:0 5px;">' + ICON_CLOSE + '</span>' +
                '</div>' +
                '<div id="widget-text" style="font-family:monospace;background:#000000;padding:12px;border-radius:8px;max-height:200px;overflow-y:auto;white-space:pre-wrap;font-size:14px;color:#ffffff;border:1px solid #1e293b;line-height:1.6;"></div>';

            document.body.appendChild(widgetRoot);

            widgetRoot.querySelector('#close-widget').onclick = function() {
                GM_setValue('widgetVisible', false);
                updateLocalState({ widgetVisible: false });
                updateFloatingWidget(GM_getValue('referenceData', ''), false);
            };
        }

        var textElement = widgetRoot.querySelector('#widget-text');
        if (textElement) {
            var html = escapeHtml(enrichedText);
            html = html.replace(/\((\d{2}\.\d{2}\.\d{4})\)/g, '<span style="color:#facc15;font-weight:bold;text-decoration:underline;">($1)</span>');
            textElement.innerHTML = html;
        }
    }

    function showSafetyModal(originalElement) {
        if (document.getElementById('smartway-safety-root')) return;

        var data = GM_getValue('referenceData', '');
        var referenceText = enrichTextWithFormattedDates(data || 'ДАННЫЕ НЕ ЗАХВАЧЕНЫ');

        var root = document.createElement('div');
        root.id = 'smartway-safety-root';
        root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:transparent;display:flex;align-items:stretch;justify-content:flex-end;z-index:2147483647;font-family:system-ui,sans-serif;pointer-events:none;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#ffffff;width:450px;padding:30px;height:100vh;box-shadow:-10px 0 30px rgba(0,0,0,0.15);color:#1e293b;border-left:1px solid #e2e8f0;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;animation:slideLeft 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:auto;overflow-y:auto;';

        var htmlContent = escapeHtml(referenceText);
        htmlContent = htmlContent.replace(/\((\d{2}\.\d{2}\.\d{4})\)/g, '<span style="background:#fef9c3;color:#854d0e;padding:2px 6px;border-radius:4px;font-weight:bold;">($1)</span>');

        modal.innerHTML =
            '<div style="overflow-y:auto;flex-grow:1;padding-right:5px;margin-bottom:20px;">' +
            '<h2 style="margin:0 0 20px;font-size:18px;text-transform:uppercase;color:#ef4444;font-weight:900;text-align:center;">Сверка перед оплатой</h2>' +
            '<div style="background:#f8fafc;border:2px solid #cbd5e1;border-radius:12px;padding:16px;font-family:monospace;font-size:14px;white-space:pre-wrap;margin-bottom:20px;max-height:200px;overflow-y:auto;color:#000000;line-height:1.5;">' + htmlContent + '</div>' +
            '<div style="margin-bottom:20px;display:flex;flex-direction:column;gap:8px;">' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>Дата поездки</span></label>' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>Время поездки</span></label>' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>Город отправления и адрес</span></label>' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>Город прибытия и адрес</span></label>' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>ФИО и паспорт пассажира</span></label>' +
            '<label style="display:flex;align-items:center;cursor:pointer;font-size:14px;padding:10px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;transition:background 0.15s;"><input type="checkbox" class="safeguard" style="width:20px;height:20px;margin-right:14px;cursor:pointer;accent-color:#10b981;"><span>Наличие багажа</span></label>' +
            '</div>' +
            '</div>' +
            '<div style="display:flex;gap:12px;margin-top:auto;">' +
            '<button id="cancel" style="flex:1;padding:14px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;color:#64748b;font-weight:800;cursor:pointer;font-size:14px;text-transform:uppercase;transition:all 0.2s;">Исправить</button>' +
            '<button id="confirm" disabled style="flex:1;padding:14px;border-radius:12px;border:none;background:#e2e8f0;color:#94a3b8;font-weight:800;cursor:not-allowed;font-size:14px;text-transform:uppercase;transition:all 0.2s;">ОПЛАТИТЬ</button>' +
            '</div>';

        root.appendChild(modal);
        document.body.appendChild(root);

        var checkboxes = root.querySelectorAll('.safeguard');
        var confirmBtn = root.querySelector('#confirm');
        var cancelBtn = root.querySelector('#cancel');

        for (var i = 0; i < checkboxes.length; i++) {
            (function(cb) {
                cb.onchange = function() {
                    var label = cb.parentElement;
                    if (cb.checked) {
                        label.style.borderColor = '#10b981';
                        label.style.background = '#f0fdf4';
                    } else {
                        label.style.borderColor = '#e2e8f0';
                        label.style.background = '#f8fafc';
                    }
                    var allChecked = true;
                    for (var j = 0; j < checkboxes.length; j++) {
                        if (!checkboxes[j].checked) { allChecked = false; break; }
                    }
                    if (allChecked) {
                        confirmBtn.disabled = false;
                        confirmBtn.style.background = '#10b981';
                        confirmBtn.style.color = '#fff';
                        confirmBtn.style.cursor = 'pointer';
                    } else {
                        confirmBtn.disabled = true;
                        confirmBtn.style.background = '#e2e8f0';
                        confirmBtn.style.color = '#94a3b8';
                        confirmBtn.style.cursor = 'not-allowed';
                    }
                };
            })(checkboxes[i]);
        }

        cancelBtn.onclick = function() { root.remove(); };

        confirmBtn.onclick = function() {
            console.log('[Ticket Guard] Клик по ОПЛАТИТЬ');

            var realBtn = originalElement;
            if (originalElement.closest) {
                var closest = originalElement.closest('button, a');
                if (closest) realBtn = closest;
            }

            // Удаляем модалку
            root.remove();

            // Ждём и вызываем клик
            setTimeout(function() {
                console.log('[Ticket Guard] Вызываю .click() на:', realBtn);
                if (typeof realBtn.click === 'function') {
                    realBtn.click();
                }
            }, 200);
        };
    }

    // Инициализация состояния
    var savedData = GM_getValue('referenceData', '');
    var savedVisible = GM_getValue('widgetVisible', true);
    console.log('[Ticket Guard] Загружено из хранилища:', { data: savedData ? 'есть' : 'нет', visible: savedVisible });
    updateLocalState({ referenceData: savedData, widgetVisible: savedVisible });
    if (savedData) {
        updateFloatingWidget(savedData, savedVisible);
    }

    // Синхронизация между вкладками
    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener('referenceData', function(name, old_value, new_value, remote) {
            console.log('[Ticket Guard] referenceData изменён');
            updateLocalState({ referenceData: new_value });
            var visible = GM_getValue('widgetVisible', true);
            updateFloatingWidget(new_value, visible);
        });
        GM_addValueChangeListener('widgetVisible', function(name, old_value, new_value, remote) {
            console.log('[Ticket Guard] widgetVisible изменён:', new_value);
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
        if (!targetConfig) {
            console.log('[Ticket Guard] Хост не в списке:', currentHost);
            return;
        }

        console.log('[Ticket Guard] Хост найден:', currentHost);

        var payButton = findPayButton(e.target);

        if (payButton) {
            var btnText = (payButton.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
            console.log('[Ticket Guard] Кнопка найдена:', btnText);

            if (!isFinalCheckoutStage(btnText, currentHost)) {
                console.log('[Ticket Guard] Не финальная стадия');
                return;
            }

            console.log('[Ticket Guard] Показываем чек-лист');
            e.preventDefault();
            e.stopPropagation();
            showSafetyModal(payButton);
        } else {
            console.log('[Ticket Guard] Кнопка не найдена');
        }
    }, true);

    console.log('[Smartway Ticket Guard v2.3] Загружен');

})();
