(function(){
  window.DCLogic = class DCLogic {
    constructor(props){ this.props = props || {}; this.state = {}; }
    setState(){}
  };

  function cssify(obj){
    return Object.keys(obj).map(function(k){
      var v = obj[k];
      var prop = k.replace(/[A-Z]/g, function(m){ return '-' + m.toLowerCase(); });
      if (typeof v === 'number' && !/^(z-index|opacity|font-weight|line-height|flex|flex-grow|flex-shrink|order)$/.test(prop)) v = v + 'px';
      return prop + ':' + v;
    }).join(';');
  }

  function evalExpr(src, scope){
    var keys = Object.keys(scope);
    try {
      return new Function(keys.join(','), 'return (' + src + ');').apply(null, keys.map(function(k){ return scope[k]; }));
    } catch(e){ return ''; }
  }

  var FULL = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
  var ANY  = /\{\{([\s\S]+?)\}\}/g;

  function interpAttr(name, value, scope){
    var m = value.match(FULL);
    if (m){
      var v = evalExpr(m[1], scope);
      if (name === 'style' && v && typeof v === 'object') return cssify(v);
      if (typeof v === 'function') return null;
      if (v === null || v === undefined || v === false) return null;
      return String(v);
    }
    return value.replace(ANY, function(_, e){
      var r = evalExpr(e, scope);
      return (r === null || r === undefined) ? '' : String(r);
    });
  }

  function process(node, scope){
    if (node.nodeType === 3){
      if (node.nodeValue.indexOf('{{') !== -1){
        node.nodeValue = node.nodeValue.replace(ANY, function(_, e){
          var r = evalExpr(e, scope);
          return (r === null || r === undefined) ? '' : String(r);
        });
      }
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = node.tagName.toLowerCase();

    if (tag === 'sc-if'){
      var keep = evalExpr((node.getAttribute('value')||'').replace(/^\s*\{\{|\}\}\s*$/g,''), scope);
      var frag = document.createDocumentFragment();
      if (keep){
        var kids = Array.prototype.slice.call(node.childNodes);
        kids.forEach(function(k){ process(k, scope); frag.appendChild(k); });
      }
      node.parentNode.replaceChild(frag, node);
      return;
    }

    if (tag === 'sc-for'){
      var list = evalExpr((node.getAttribute('list')||'').replace(/^\s*\{\{|\}\}\s*$/g,''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      var out = document.createDocumentFragment();
      var tpl = node.innerHTML;
      (Array.isArray(list) ? list : []).forEach(function(item, i){
        var holder = document.createElement('div');
        holder.innerHTML = tpl;
        var s = Object.assign({}, scope);
        s[as] = item; s['$index'] = i;
        Array.prototype.slice.call(holder.childNodes).forEach(function(k){ process(k, s); });
        while (holder.firstChild) out.appendChild(holder.firstChild);
      });
      node.parentNode.replaceChild(out, node);
      return;
    }

    Array.prototype.slice.call(node.attributes).forEach(function(a){
      if (a.name === 'style-hover' || a.name.indexOf('hint-') === 0){ node.removeAttribute(a.name); return; }
      if (a.value.indexOf('{{') === -1) return;
      var v = interpAttr(a.name, a.value, scope);
      if (v === null) node.removeAttribute(a.name); else node.setAttribute(a.name, v);
    });

    Array.prototype.slice.call(node.childNodes).forEach(function(k){ process(k, scope); });
  }

  window.__dcRender = function(){
    var script = document.querySelector('script[data-dc-script]');
    var vals = {};
    if (script){
      var propsMeta = {};
      try { propsMeta = JSON.parse(script.getAttribute('data-props') || '{}'); } catch(e){}
      var props = {};
      Object.keys(propsMeta).forEach(function(k){ props[k] = propsMeta[k].default; });
      try {
        var Ctor = new Function('DCLogic', script.textContent + '; return Component;')(window.DCLogic);
        vals = new Ctor(props).renderVals() || {};
      } catch(e){ console.error('renderVals failed:', e.message); }
      script.remove();
    }
    var root = document.querySelector('x-dc') || document.body;
    Array.prototype.slice.call(root.childNodes).forEach(function(k){ process(k, vals); });
    var helmet = document.querySelector('helmet'); if (helmet) helmet.remove();
    document.body.setAttribute('data-dc-done','1');
  };
})();
