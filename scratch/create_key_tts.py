import websocket
import json
import urllib.request
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    click_tts_access_js = """
    (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.innerText.includes('Create API Key'));
        const span = Array.from(dialog.querySelectorAll('span')).find(s => s.innerText.trim() === 'Text to Speech');
        if (!span) return 'SPAN_NOT_FOUND';
        
        let row = span;
        while (row && !row.querySelectorAll('button').length) {
            row = row.parentElement;
        }
        
        const accessBtn = Array.from(row.querySelectorAll('button')).find(b => b.innerText.trim() === 'Access');
        if (!accessBtn) return 'ACCESS_BTN_NOT_FOUND';
        
        accessBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        accessBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        accessBtn.click();
        accessBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        accessBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        
        return {
            clicked: true,
            newState: accessBtn.getAttribute('data-state'),
            ariaSelected: accessBtn.getAttribute('aria-selected')
        };
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': click_tts_access_js, 'returnByValue': True}}))
    res = json.loads(ws.recv())
    print("Click result:", json.dumps(res.get('result', {}).get('result', {}).get('value', {}), indent=2))

    # Also let's set a name for the key
    name_js = """
    (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.innerText.includes('Create API Key'));
        const input = dialog.querySelector('input[placeholder="API Key Name"]');
        if (input) {
            input.value = 'APEX-Voice';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return 'NAME_SET';
        }
        return 'INPUT_NOT_FOUND';
    })()
    """
    ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {'expression': name_js}}))
    res2 = json.loads(ws.recv())
    print("Name result:", res2.get('result', {}).get('result', {}).get('value'))

    # Now click Create Key at the bottom of the dialog
    submit_js = """
    (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.innerText.includes('Create API Key'));
        const btns = Array.from(dialog.querySelectorAll('button'));
        const submitBtn = btns.find(b => b.innerText.trim() === 'Create Key');
        if (submitBtn) {
            submitBtn.click();
            return 'SUBMIT_CLICKED';
        }
        return 'SUBMIT_NOT_FOUND';
    })()
    """
    ws.send(json.dumps({'id': 3, 'method': 'Runtime.evaluate', 'params': {'expression': submit_js}}))
    res3 = json.loads(ws.recv())
    print("Submit result:", res3.get('result', {}).get('result', {}).get('value'))

    time.sleep(2.5)

    # Now find the created key
    get_key_js = """
    (() => {
        const input = Array.from(document.querySelectorAll('input')).find(i => i.value && i.value.startsWith('sk_'));
        return input ? input.value : 'KEY_NOT_FOUND';
    })()
    """
    ws.send(json.dumps({'id': 4, 'method': 'Runtime.evaluate', 'params': {'expression': get_key_js}}))
    res4 = json.loads(ws.recv())
    key = res4.get('result', {}).get('result', {}).get('value')
    print("NEW_KEY:", key)
    ws.close()

if __name__ == '__main__':
    run()
