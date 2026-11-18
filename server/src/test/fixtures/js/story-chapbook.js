/* Chapbook Story JavaScript w/an inventory insert, a gold variable, and event handlers */
engine.extend('2.0.0', () => {
    config.template.inserts = [{
        match: /{inventory}/i,
        render: () => engine.state.get('inventory').join(', '),
    }, ...config.template.inserts];
});
engine.state.set('gold', 10);
window.addGold = function (amount) {
    engine.state.set('gold', engine.state.get('gold') + amount);
    return gold;
};
window.handler0 = function (ev) { let x0 = engine.state.get('counter0') + 0; engine.state.set('flag0', x0 > 3); return x0; };
window.handler1 = function (ev) { let x1 = engine.state.get('counter1') + 1; engine.state.set('flag1', x1 > 3); return x1; };
window.handler2 = function (ev) { let x2 = engine.state.get('counter2') + 2; engine.state.set('flag2', x2 > 3); return x2; };
window.handler3 = function (ev) { let x3 = engine.state.get('counter3') + 3; engine.state.set('flag3', x3 > 3); return x3; };
window.handler4 = function (ev) { let x4 = engine.state.get('counter0') + 4; engine.state.set('flag4', x4 > 3); return x4; };
window.handler5 = function (ev) { let x5 = engine.state.get('counter1') + 5; engine.state.set('flag5', x5 > 3); return x5; };
window.handler6 = function (ev) { let x6 = engine.state.get('counter2') + 6; engine.state.set('flag6', x6 > 3); return x6; };
window.handler7 = function (ev) { let x7 = engine.state.get('counter3') + 7; engine.state.set('flag7', x7 > 3); return x7; };
window.handler8 = function (ev) { let x8 = engine.state.get('counter0') + 8; engine.state.set('flag8', x8 > 3); return x8; };
window.handler9 = function (ev) { let x9 = engine.state.get('counter1') + 9; engine.state.set('flag9', x9 > 3); return x9; };
window.handler10 = function (ev) { let x10 = engine.state.get('counter2') + 10; engine.state.set('flag10', x10 > 3); return x10; };
window.handler11 = function (ev) { let x11 = engine.state.get('counter3') + 11; engine.state.set('flag11', x11 > 3); return x11; };