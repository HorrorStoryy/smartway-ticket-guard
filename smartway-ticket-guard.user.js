// ==UserScript==
// @name         Smartway Ticket Guard
// @namespace    https://smartway.today/
// @version      3.0
// @description  Чек-лист перед оплатой на сайтах партнеров Smartway
// @author       Smartway
// @match        https://*/*
// @match        http://*/*
// @grant        none
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

    var isInternalClick = false;

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

        if (hostname.indexOf('avtovokzaly.ru') !== -1) {
            var isCheckoutPath = url.indexOf('checkout') !== -1 || url.indexOf('order') !== -1 ||
                url.indexOf('buy') !== -1 || url.indexOf('passenger') !== -1 || url.indexOf('ticket') !== -1;
            var isExplicitBuy = btnLower.indexOf('купить') !== -1 || btnLower.indexOf('оплатить') !== -1;
            return hasVisibleInputs || (isCheckoutPath && markersFound >= 1) || (isCheckoutPath && isExplicitBuy);
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

    function showSafetyModal(originalElement) {
        if (document.getElementById('smartway-safety-root')) return;

        var root = document.createElement('div');
        root.id = 'smartway-safety-root';
        root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:transparent;display:flex;align-items:stretch;justify-content:flex-end;z-index:2147483647;font-family:system-ui,sans-serif;pointer-events:none;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#ffffff;width:450px;padding:30px;height:100vh;box-shadow:-10px 0 30px rgba(0,0,0,0.15);color:#1e293b;border-left:1px solid #e2e8f0;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;animation:slideLeft 0.3s cubic-bezier(0.16,1,0.3,1);pointer-events:auto;overflow-y:auto;';

        modal.innerHTML =
            '<div style="overflow-y:auto;flex-grow:1;padding-right:5px;margin-bottom:20px;">' +
            '<h2 style="margin:0 0 20px;font-size:18px;text-transform:uppercase;color:#ef4444;font-weight:900;text-align:center;">Сверка перед оплатой</h2>' +
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
            console.log('[Ticket Guard] Подтверждение оплаты');
            isInternalClick = true;

            var targetEl = originalElement;
            if (targetEl.tagName !== 'BUTTON' && targetEl.tagName !== 'A' && targetEl.tagName !== 'INPUT') {
                targetEl = targetEl.closest('button, a, input[type="submit"], input[type="button"]') || targetEl;
            }

            root.remove();

            setTimeout(function() {
                try {
                    var form = targetEl.closest('form');
                    if (form) {
                        console.log('[Ticket Guard] Уровень 1: form.requestSubmit()');
                        if (typeof form.requestSubmit === 'function') {
                            form.requestSubmit(targetEl);
                        } else {
                            form.submit();
                        }
                        isInternalClick = false;
                        return;
                    }

                    var href = targetEl.getAttribute('href');
                    if (href && href !== '#' && href.indexOf('javascript:') !== 0) {
                        console.log('[Ticket Guard] Уровень 2: Переход по href:', href);
                        window.location.href = href;
                        isInternalClick = false;
                        return;
                    }

                    console.log('[Ticket Guard] Уровень 3: Эмуляция клика');
                    targetEl.focus();
                    targetEl.click();

                    setTimeout(function() {
                        var rect = targetEl.getBoundingClientRect();
                        var centerX = rect.left + rect.width / 2;
                        var centerY = rect.top + rect.height / 2;

                        var commonProps = {
                            bubbles: true, cancelable: true, view: window,
                            clientX: centerX, clientY: centerY,
                            screenX: centerX, screenY: centerY, button: 0
                        };

                        targetEl.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, commonProps, { pointerType: 'mouse', isPrimary: true })));
                        targetEl.dispatchEvent(new MouseEvent('mousedown', commonProps));
                        targetEl.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, commonProps, { pointerType: 'mouse', isPrimary: true })));
                        targetEl.dispatchEvent(new MouseEvent('mouseup', commonProps));
                        targetEl.dispatchEvent(new MouseEvent('click', commonProps));

                        if (typeof window.jQuery !== 'undefined' && window.jQuery(targetEl).length) {
                            window.jQuery(targetEl).trigger('click');
                        }

                        console.log('[Ticket Guard] Эмуляция завершена');
                        isInternalClick = false;
                    }, 50);

                } catch (err) {
                    console.error('[Ticket Guard] Ошибка при клике:', err);
                    isInternalClick = false;
                }
            }, 100);
        };
    }

    document.addEventListener('click', function(e) {
        if (isInternalClick) return;

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

            if (!isFinalCheckoutStage(btnText, currentHost)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showSafetyModal(payButton);
        }
    }, true);

    console.log('[Smartway Ticket Guard v3.0] Загружен');

})();
