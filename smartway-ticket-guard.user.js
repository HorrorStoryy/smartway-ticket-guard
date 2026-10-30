// ==UserScript==
// @name         Smartway Ticket Guard
// @namespace    https://smartway.today/
// @version      3.1
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

    const TARGETS = [
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

    const KEYWORDS = ['оформить билет', 'оформить', 'оплатить', 'купить', 'забронировать', 'далее', 'подтвердить', 'pay', 'order', 'продолжить', 'бронировать', 'купить за', 'оплатить картой', 'перейти к оплате'];

    let isInternalClick = false;

    // ОРИГИНАЛЬНАЯ ЛОГИКА из content.js
    function isFinalCheckoutStage(buttonText, hostname) {
        const url = window.location.href.toLowerCase();
        const pageText = (document.body.innerText || '').toLowerCase();

        const hasVisiblePassword = !!Array.from(document.querySelectorAll('input[type="password"]'))
            .find(el => el.offsetParent !== null || el.offsetWidth > 0);
        if (hasVisiblePassword) return false;

        if (hostname.includes('smart-mobility.ru') || hostname.includes('smarttravel.ru')) {
            const isAction = KEYWORDS.some(word => buttonText.includes(word));
            if (isAction) return true;
        }

        const isSearchPage = url.includes('/search') || url.includes('/results') || url.includes('/rasp') || url.includes('/shedule') || url.includes('/selection');
        if (isSearchPage) return false;

        const criticalSelectors = [
            'input[name*="surname"]', 'input[name*="lastname"]', 'input[name*="fio"]',
            'input[placeholder*="Фамилия"]', 'input[placeholder*="Имя"]', 'input[placeholder*="Паспорт"]',
            'input[placeholder*="Документ"]', 'input[aria-label*="Фамилия"]', 'input[data-vv-name*="passenger"]',
            'input[name*="passenger"]', 'input[id*="pas"]', 'input[id*="doc"]', 'input[id*="passenger"]', 'input[name*="doc"]'
        ];

        const hasVisibleInputs = Array.from(document.querySelectorAll(criticalSelectors.join(', ')))
            .some(el => el.offsetParent !== null || el.offsetWidth > 0);

        const markers = ['пассажир', 'фамилия', 'паспорт', 'номер документа', 'данные пассажира', 'сведения о пассажире'];
        const markersFound = markers.filter(m => pageText.includes(m)).length;

        if (hostname.includes('avtovokzaly.ru')) {
            const isCheckoutPath = url.includes('checkout') || url.includes('order') || url.includes('buy') || url.includes('passenger');
            return hasVisibleInputs || (isCheckoutPath && markersFound >= 1);
        }

        if (hostname.includes('e-traffic.ru')) return hasVisibleInputs;
        if (hostname.includes('tutu.ru')) return hasVisibleInputs || markersFound >= 2;
        if (hostname.includes('avperm.ru')) {
            return buttonText.includes('купить билет') || buttonText.includes('перейти к оплате');
        }
        if (hostname.includes('unitiki.com')) {
            return buttonText.includes('купить билет');
        }

        const isBookingUrl = url.includes('buy') || url.includes('booking') || url.includes('order') || url.includes('pay') || url.includes('ticket');
        return hasVisibleInputs || (isBookingUrl && markersFound >= 1);
    }

    function findPayButton(element) {
        if (!element || element === document) return null;
        const btn = element.closest("button, a, [role='button'], .v-btn, .btn, .button, .btn-pay, .ticket-btn, .button-pay, [class*='button'], [class*='btn']");
        if (!btn) return null;

        const text = (btn.innerText || btn.textContent || btn.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const isMatch = KEYWORDS.some(word => text.includes(word)) || /купить\s+за/i.test(text);

        if (isMatch) {
            const href = btn.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !isFinalCheckoutStage(text, window.location.hostname)) {
                return null;
            }
            return btn;
        }
        return null;
    }

    // ОРИГИНАЛЬНАЯ ЛОГИКА МОДАЛКИ из content.js
    function showSafetyModal(originalElement) {
        if (document.getElementById('smartway-safety-root')) return;

        const root = document.createElement('div');
        root.id = 'smartway-safety-root';
        document.body.appendChild(root);

        const shadow = root.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            .overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: transparent;
                display: flex; align-items: stretch; justify-content: flex-end;
                z-index: 2147483647; font-family: system-ui, sans-serif;
                pointer-events: none;
            }
            .modal {
                background: #ffffff; width: 450px; padding: 30px; height: 100vh;
                box-shadow: -10px 0 30px rgba(0,0,0,0.15); color: #1e293b;
                border-left: 1px solid #e2e8f0;
                box-sizing: border-box;
                display: flex; flex-direction: column; justify-content: space-between;
                animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: auto;
            }
            @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
            .modal-scrollable { overflow-y: auto; flex-grow: 1; padding-right: 5px; margin-bottom: 20px; }
            h2 { margin: 0 0 20px; font-size: 18px; text-transform: uppercase; color: #ef4444; font-weight: 900; text-align: center; }
            .checklist { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
            .check-item {
                display: flex; align-items: center; cursor: pointer;
                font-size: 14px; padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0;
                transition: background 0.15s;
            }
            .check-item:hover { background: #f1f5f9; }
            .check-item.checked { border-color: #10b981; background: #f0fdf4; }
            .check-item input { width: 20px; height: 20px; margin-right: 14px; cursor: pointer; accent-color: #10b981; }
            .actions { display: flex; gap: 12px; margin-top: auto; }
            .btn { flex: 1; padding: 14px; border-radius: 12px; border: none; font-weight: 800; cursor: pointer; font-size: 14px; text-transform: uppercase; transition: all 0.2s; }
            .btn-pay { background: #10b981; color: #fff; }
            .btn-pay:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
            .btn-cancel { background: #fff; border: 2px solid #e2e8f0; color: #64748b; }
            .btn-cancel:hover { background: #f1f5f9; }
        `;

        const container = document.createElement('div');
        container.className = 'overlay';
        container.innerHTML = `
            <div class="modal">
                <div class="modal-scrollable">
                    <h2>Сверка перед оплатой</h2>
                    <div class="checklist">
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>Дата поездки</span></label>
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>Время поездки</span></label>
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>Город отправления и адрес</span></label>
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>Город прибытия и адрес</span></label>
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>ФИО и паспорт пассажира</span></label>
                        <label class="check-item"><input type="checkbox" class="safeguard"><span>Наличие багажа</span></label>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn btn-cancel" id="cancel">Исправить</button>
                    <button class="btn btn-pay" id="confirm" disabled>ОПЛАТИТЬ</button>
                </div>
            </div>
        `;

        shadow.appendChild(style);
        shadow.appendChild(container);

        const checkboxes = shadow.querySelectorAll('.safeguard');
        const confirmBtn = shadow.getElementById('confirm');
        const cancelBtn = shadow.getElementById('cancel');

        checkboxes.forEach(cb => {
            cb.onchange = () => {
                cb.closest('.check-item').classList.toggle('checked', cb.checked);
                confirmBtn.disabled = !Array.from(checkboxes).every(c => c.checked);
            };
        });

        cancelBtn.onclick = () => root.remove();

        // ОРИГИНАЛЬНАЯ ЛОГИКА КЛИКА из content.js
        confirmBtn.onclick = () => {
            isInternalClick = true;
            const triggerClick = (el) => {
                ['mousedown', 'mouseup', 'click'].forEach(name => {
                    el.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
                });
            };
            const realBtn = originalElement.closest('button, a') || originalElement;
            triggerClick(realBtn);
            isInternalClick = false;
            root.remove();
        };
    }

    // ОРИГИНАЛЬНЫЙ ПЕРЕХВАТЧИК КЛИКОВ из content.js
    document.addEventListener('click', (e) => {
        if (isInternalClick) return;

        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            const type = (e.target.type || '').toLowerCase();
            if (type !== 'submit' && type !== 'button' && type !== 'reset') return;
        }

        const currentHost = window.location.hostname;
        const targetConfig = TARGETS.find(t => currentHost.includes(t.domain));
        if (!targetConfig) return;

        let payButton = findPayButton(e.target) || e.target.closest(targetConfig.selector);

        if (payButton) {
            const buttonText = (payButton.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!isFinalCheckoutStage(buttonText, currentHost)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showSafetyModal(payButton);
        }
    }, true);

    console.log('[Smartway Ticket Guard v3.1] Загружен с оригинальной логикой');

})();
