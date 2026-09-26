// The Pharmacy: spend ATP between waves. Works on the current break state `S.brk`
// (the adaptation choices on offer, whether one was picked, what was stocked).
(() => {
  const V = window.VAX;
  const shop = V.shop = {};

  shop.price = id => {
    const S = V.G.S;
    if (id.startsWith('stock:')) return V.POW[id.slice(6)].tier === 2 ? V.SHOP.stock.tier2 : V.SHOP.stock.tier1;
    const it = V.SHOP[id], n = id === 'reroll' ? S.brk.rerolls : (S.buys[id] || 0);
    return it.base + it.step * n;
  };

  // everything on the shelf right now, with whether it can be bought and why not
  shop.items = () => {
    const { S, P } = V.G, b = S.brk;
    const list = [];
    const { t, tx } = V;
    const add = (id, name, desc, icon, available, whyNot) => {
      const price = shop.price(id);
      const closed = S.M && S.M.noShop;   // daily rule: the Pharmacy is shut
      list.push({ id, name, desc, icon, price, ok: !closed && available && S.atp >= price, why: closed ? t('shop.closed') : !available ? t(whyNot) : S.atp < price ? t('shop.needAtp') : '' });
    };
    const I = V.SHOP, item = (id, ok, why) => add(id, tx.shop(id), tx.shopDesc(id), I[id].icon, ok, why);
    item('heal', P.hp < P.max, 'shop.full');
    item('shield', P.shield < 2, 'shop.shieldFull');
    item('maxhp', (S.buys.maxhp || 0) < I.maxhp.limit, 'shop.soldOut');
    item('reroll', !b.picked && b.choices.length > 0, 'shop.picked');
    item('extra', b.picked && !b.extraUsed, b.extraUsed ? 'shop.once' : 'shop.pickFirst');
    for (const k of b.stockOffer) {
      add('stock:' + k, t('shop.stock', { name: tx.pow(k) }), t('shop.stockDesc'), k, !b.stocked.includes(k), 'shop.stocked');
    }
    return list;
  };

  shop.buy = id => {
    const { S, P } = V.G, b = S.brk;
    const item = shop.items().find(i => i.id === id);
    if (!item || !item.ok) { V.SND.nope(); return false; }
    S.atp -= item.price;
    if (id.startsWith('stock:')) { const k = id.slice(6); b.stocked.push(k); S.stock.push(k); }
    else {
      S.buys[id] = (S.buys[id] || 0) + (id === 'reroll' ? 0 : 1);
      if (id === 'heal') P.hp = Math.min(P.max, P.hp + 1);
      if (id === 'shield') P.shield = Math.min(2, P.shield + 1);
      if (id === 'maxhp') { P.max++; P.hp++; }
      if (id === 'reroll') { b.rerolls++; b.choices = V.game.rollChoices(); }
      if (id === 'extra') { b.extraUsed = true; b.picked = false; b.pickedId = null; b.choices = V.game.rollChoices(); }
    }
    V.SND.buy(); V.meta.event('buy', { price: item.price });
    V.ui.hud(true); V.ui.renderBreak();
    return true;
  };
})();
