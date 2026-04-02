//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (e && (t = e(e = 0)), t), s = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), c = (e, n) => {
	let r = {};
	for (var i in e) t(r, i, {
		get: e[i],
		enumerable: !0
	});
	return n || t(r, Symbol.toStringTag, { value: "Module" }), r;
}, l = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, u = (n, r, a) => (a = n == null ? {} : e(i(n)), l(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)), d = o((() => {})), f, p, m, h, g = o((() => {
	f = /* @__PURE__ */ ((e) => (e.Application = "application", e.WebGLPipes = "webgl-pipes", e.WebGLPipesAdaptor = "webgl-pipes-adaptor", e.WebGLSystem = "webgl-system", e.WebGPUPipes = "webgpu-pipes", e.WebGPUPipesAdaptor = "webgpu-pipes-adaptor", e.WebGPUSystem = "webgpu-system", e.CanvasSystem = "canvas-system", e.CanvasPipesAdaptor = "canvas-pipes-adaptor", e.CanvasPipes = "canvas-pipes", e.Asset = "asset", e.LoadParser = "load-parser", e.ResolveParser = "resolve-parser", e.CacheParser = "cache-parser", e.DetectionParser = "detection-parser", e.MaskEffect = "mask-effect", e.BlendMode = "blend-mode", e.TextureSource = "texture-source", e.Environment = "environment", e.ShapeBuilder = "shape-builder", e.Batcher = "batcher", e))(f || {}), p = (e) => {
		if (typeof e == "function" || typeof e == "object" && e.extension) {
			if (!e.extension) throw Error("Extension class must have an extension object");
			e = {
				...typeof e.extension == "object" ? e.extension : { type: e.extension },
				ref: e
			};
		}
		if (typeof e == "object") e = { ...e };
		else throw Error("Invalid extension type");
		return typeof e.type == "string" && (e.type = [e.type]), e;
	}, m = (e, t) => p(e).priority ?? t, h = {
		_addHandlers: {},
		_removeHandlers: {},
		_queue: {},
		remove(...e) {
			return e.map(p).forEach((e) => {
				e.type.forEach((t) => this._removeHandlers[t]?.(e));
			}), this;
		},
		add(...e) {
			return e.map(p).forEach((e) => {
				e.type.forEach((t) => {
					let n = this._addHandlers, r = this._queue;
					n[t] ? n[t]?.(e) : (r[t] = r[t] || [], r[t]?.push(e));
				});
			}), this;
		},
		handle(e, t, n) {
			let r = this._addHandlers, i = this._removeHandlers;
			if (r[e] || i[e]) throw Error(`Extension type ${e} already has a handler`);
			r[e] = t, i[e] = n;
			let a = this._queue;
			return a[e] && (a[e]?.forEach((e) => t(e)), delete a[e]), this;
		},
		handleByMap(e, t) {
			return this.handle(e, (e) => {
				e.name && (t[e.name] = e.ref);
			}, (e) => {
				e.name && delete t[e.name];
			});
		},
		handleByNamedList(e, t, n = -1) {
			return this.handle(e, (e) => {
				t.findIndex((t) => t.name === e.name) >= 0 || (t.push({
					name: e.name,
					value: e.ref
				}), t.sort((e, t) => m(t.value, n) - m(e.value, n)));
			}, (e) => {
				let n = t.findIndex((t) => t.name === e.name);
				n !== -1 && t.splice(n, 1);
			});
		},
		handleByList(e, t, n = -1) {
			return this.handle(e, (e) => {
				t.includes(e.ref) || (t.push(e.ref), t.sort((e, t) => m(t, n) - m(e, n)));
			}, (e) => {
				let n = t.indexOf(e.ref);
				n !== -1 && t.splice(n, 1);
			});
		},
		mixin(e, ...t) {
			for (let n of t) Object.defineProperties(e.prototype, Object.getOwnPropertyDescriptors(n));
		}
	};
})), _ = /* @__PURE__ */ s(((e, t) => {
	var n = Object.prototype.hasOwnProperty, r = "~";
	function i() {}
	Object.create && (i.prototype = Object.create(null), new i().__proto__ || (r = !1));
	function a(e, t, n) {
		this.fn = e, this.context = t, this.once = n || !1;
	}
	function o(e, t, n, i, o) {
		if (typeof n != "function") throw TypeError("The listener must be a function");
		var s = new a(n, i || e, o), c = r ? r + t : t;
		return e._events[c] ? e._events[c].fn ? e._events[c] = [e._events[c], s] : e._events[c].push(s) : (e._events[c] = s, e._eventsCount++), e;
	}
	function s(e, t) {
		--e._eventsCount === 0 ? e._events = new i() : delete e._events[t];
	}
	function c() {
		this._events = new i(), this._eventsCount = 0;
	}
	c.prototype.eventNames = function() {
		var e = [], t, i;
		if (this._eventsCount === 0) return e;
		for (i in t = this._events) n.call(t, i) && e.push(r ? i.slice(1) : i);
		return Object.getOwnPropertySymbols ? e.concat(Object.getOwnPropertySymbols(t)) : e;
	}, c.prototype.listeners = function(e) {
		var t = r ? r + e : e, n = this._events[t];
		if (!n) return [];
		if (n.fn) return [n.fn];
		for (var i = 0, a = n.length, o = Array(a); i < a; i++) o[i] = n[i].fn;
		return o;
	}, c.prototype.listenerCount = function(e) {
		var t = r ? r + e : e, n = this._events[t];
		return n ? n.fn ? 1 : n.length : 0;
	}, c.prototype.emit = function(e, t, n, i, a, o) {
		var s = r ? r + e : e;
		if (!this._events[s]) return !1;
		var c = this._events[s], l = arguments.length, u, d;
		if (c.fn) {
			switch (c.once && this.removeListener(e, c.fn, void 0, !0), l) {
				case 1: return c.fn.call(c.context), !0;
				case 2: return c.fn.call(c.context, t), !0;
				case 3: return c.fn.call(c.context, t, n), !0;
				case 4: return c.fn.call(c.context, t, n, i), !0;
				case 5: return c.fn.call(c.context, t, n, i, a), !0;
				case 6: return c.fn.call(c.context, t, n, i, a, o), !0;
			}
			for (d = 1, u = Array(l - 1); d < l; d++) u[d - 1] = arguments[d];
			c.fn.apply(c.context, u);
		} else {
			var f = c.length, p;
			for (d = 0; d < f; d++) switch (c[d].once && this.removeListener(e, c[d].fn, void 0, !0), l) {
				case 1:
					c[d].fn.call(c[d].context);
					break;
				case 2:
					c[d].fn.call(c[d].context, t);
					break;
				case 3:
					c[d].fn.call(c[d].context, t, n);
					break;
				case 4:
					c[d].fn.call(c[d].context, t, n, i);
					break;
				default:
					if (!u) for (p = 1, u = Array(l - 1); p < l; p++) u[p - 1] = arguments[p];
					c[d].fn.apply(c[d].context, u);
			}
		}
		return !0;
	}, c.prototype.on = function(e, t, n) {
		return o(this, e, t, n, !1);
	}, c.prototype.once = function(e, t, n) {
		return o(this, e, t, n, !0);
	}, c.prototype.removeListener = function(e, t, n, i) {
		var a = r ? r + e : e;
		if (!this._events[a]) return this;
		if (!t) return s(this, a), this;
		var o = this._events[a];
		if (o.fn) o.fn === t && (!i || o.once) && (!n || o.context === n) && s(this, a);
		else {
			for (var c = 0, l = [], u = o.length; c < u; c++) (o[c].fn !== t || i && !o[c].once || n && o[c].context !== n) && l.push(o[c]);
			l.length ? this._events[a] = l.length === 1 ? l[0] : l : s(this, a);
		}
		return this;
	}, c.prototype.removeAllListeners = function(e) {
		var t;
		return e ? (t = r ? r + e : e, this._events[t] && s(this, t)) : (this._events = new i(), this._eventsCount = 0), this;
	}, c.prototype.off = c.prototype.removeListener, c.prototype.addListener = c.prototype.on, c.prefixed = r, c.EventEmitter = c, t !== void 0 && (t.exports = c);
})), v, y, b = o((() => {
	v = /* @__PURE__ */ u(_(), 1), y = v.default;
})), x, S, C, w, T, E, D, O, k, A, j, M, N, ee, te, ne, re, ie, P, ae, oe, se, ce, le, ue, de, fe, pe, me, he = o((() => {
	x = {
		grad: .9,
		turn: 360,
		rad: 360 / (2 * Math.PI)
	}, S = function(e) {
		return typeof e == "string" ? e.length > 0 : typeof e == "number";
	}, C = function(e, t, n) {
		return t === void 0 && (t = 0), n === void 0 && (n = 10 ** t), Math.round(n * e) / n + 0;
	}, w = function(e, t, n) {
		return t === void 0 && (t = 0), n === void 0 && (n = 1), e > n ? n : e > t ? e : t;
	}, T = function(e) {
		return (e = isFinite(e) ? e % 360 : 0) > 0 ? e : e + 360;
	}, E = function(e) {
		return {
			r: w(e.r, 0, 255),
			g: w(e.g, 0, 255),
			b: w(e.b, 0, 255),
			a: w(e.a)
		};
	}, D = function(e) {
		return {
			r: C(e.r),
			g: C(e.g),
			b: C(e.b),
			a: C(e.a, 3)
		};
	}, O = /^#([0-9a-f]{3,8})$/i, k = function(e) {
		var t = e.toString(16);
		return t.length < 2 ? "0" + t : t;
	}, A = function(e) {
		var t = e.r, n = e.g, r = e.b, i = e.a, a = Math.max(t, n, r), o = a - Math.min(t, n, r), s = o ? a === t ? (n - r) / o : a === n ? 2 + (r - t) / o : 4 + (t - n) / o : 0;
		return {
			h: 60 * (s < 0 ? s + 6 : s),
			s: a ? o / a * 100 : 0,
			v: a / 255 * 100,
			a: i
		};
	}, j = function(e) {
		var t = e.h, n = e.s, r = e.v, i = e.a;
		t = t / 360 * 6, n /= 100, r /= 100;
		var a = Math.floor(t), o = r * (1 - n), s = r * (1 - (t - a) * n), c = r * (1 - (1 - t + a) * n), l = a % 6;
		return {
			r: 255 * [
				r,
				s,
				o,
				o,
				c,
				r
			][l],
			g: 255 * [
				c,
				r,
				r,
				s,
				o,
				o
			][l],
			b: 255 * [
				o,
				o,
				c,
				r,
				r,
				s
			][l],
			a: i
		};
	}, M = function(e) {
		return {
			h: T(e.h),
			s: w(e.s, 0, 100),
			l: w(e.l, 0, 100),
			a: w(e.a)
		};
	}, N = function(e) {
		return {
			h: C(e.h),
			s: C(e.s),
			l: C(e.l),
			a: C(e.a, 3)
		};
	}, ee = function(e) {
		return j((n = (t = e).s, {
			h: t.h,
			s: (n *= ((r = t.l) < 50 ? r : 100 - r) / 100) > 0 ? 2 * n / (r + n) * 100 : 0,
			v: r + n,
			a: t.a
		}));
		var t, n, r;
	}, te = function(e) {
		return {
			h: (t = A(e)).h,
			s: (i = (200 - (n = t.s)) * (r = t.v) / 100) > 0 && i < 200 ? n * r / 100 / (i <= 100 ? i : 200 - i) * 100 : 0,
			l: i / 2,
			a: t.a
		};
		var t, n, r, i;
	}, ne = /^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*,\s*([+-]?\d*\.?\d+)%\s*,\s*([+-]?\d*\.?\d+)%\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, re = /^hsla?\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s+([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)%\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, ie = /^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*,\s*([+-]?\d*\.?\d+)(%)?\s*(?:,\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, P = /^rgba?\(\s*([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s+([+-]?\d*\.?\d+)(%)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i, ae = {
		string: [
			[function(e) {
				var t = O.exec(e);
				return t ? (e = t[1]).length <= 4 ? {
					r: parseInt(e[0] + e[0], 16),
					g: parseInt(e[1] + e[1], 16),
					b: parseInt(e[2] + e[2], 16),
					a: e.length === 4 ? C(parseInt(e[3] + e[3], 16) / 255, 2) : 1
				} : e.length === 6 || e.length === 8 ? {
					r: parseInt(e.substr(0, 2), 16),
					g: parseInt(e.substr(2, 2), 16),
					b: parseInt(e.substr(4, 2), 16),
					a: e.length === 8 ? C(parseInt(e.substr(6, 2), 16) / 255, 2) : 1
				} : null : null;
			}, "hex"],
			[function(e) {
				var t = ie.exec(e) || P.exec(e);
				return t ? t[2] !== t[4] || t[4] !== t[6] ? null : E({
					r: Number(t[1]) / (t[2] ? 100 / 255 : 1),
					g: Number(t[3]) / (t[4] ? 100 / 255 : 1),
					b: Number(t[5]) / (t[6] ? 100 / 255 : 1),
					a: t[7] === void 0 ? 1 : Number(t[7]) / (t[8] ? 100 : 1)
				}) : null;
			}, "rgb"],
			[function(e) {
				var t = ne.exec(e) || re.exec(e);
				if (!t) return null;
				var n, r;
				return ee(M({
					h: (n = t[1], r = t[2], r === void 0 && (r = "deg"), Number(n) * (x[r] || 1)),
					s: Number(t[3]),
					l: Number(t[4]),
					a: t[5] === void 0 ? 1 : Number(t[5]) / (t[6] ? 100 : 1)
				}));
			}, "hsl"]
		],
		object: [
			[function(e) {
				var t = e.r, n = e.g, r = e.b, i = e.a, a = i === void 0 ? 1 : i;
				return S(t) && S(n) && S(r) ? E({
					r: Number(t),
					g: Number(n),
					b: Number(r),
					a: Number(a)
				}) : null;
			}, "rgb"],
			[function(e) {
				var t = e.h, n = e.s, r = e.l, i = e.a, a = i === void 0 ? 1 : i;
				return !S(t) || !S(n) || !S(r) ? null : ee(M({
					h: Number(t),
					s: Number(n),
					l: Number(r),
					a: Number(a)
				}));
			}, "hsl"],
			[function(e) {
				var t = e.h, n = e.s, r = e.v, i = e.a, a = i === void 0 ? 1 : i;
				return !S(t) || !S(n) || !S(r) ? null : j(function(e) {
					return {
						h: T(e.h),
						s: w(e.s, 0, 100),
						v: w(e.v, 0, 100),
						a: w(e.a)
					};
				}({
					h: Number(t),
					s: Number(n),
					v: Number(r),
					a: Number(a)
				}));
			}, "hsv"]
		]
	}, oe = function(e, t) {
		for (var n = 0; n < t.length; n++) {
			var r = t[n][0](e);
			if (r) return [r, t[n][1]];
		}
		return [null, void 0];
	}, se = function(e) {
		return typeof e == "string" ? oe(e.trim(), ae.string) : typeof e == "object" && e ? oe(e, ae.object) : [null, void 0];
	}, ce = function(e, t) {
		var n = te(e);
		return {
			h: n.h,
			s: w(n.s + 100 * t, 0, 100),
			l: n.l,
			a: n.a
		};
	}, le = function(e) {
		return (299 * e.r + 587 * e.g + 114 * e.b) / 1e3 / 255;
	}, ue = function(e, t) {
		var n = te(e);
		return {
			h: n.h,
			s: n.s,
			l: w(n.l + 100 * t, 0, 100),
			a: n.a
		};
	}, de = function() {
		function e(e) {
			this.parsed = se(e)[0], this.rgba = this.parsed || {
				r: 0,
				g: 0,
				b: 0,
				a: 1
			};
		}
		return e.prototype.isValid = function() {
			return this.parsed !== null;
		}, e.prototype.brightness = function() {
			return C(le(this.rgba), 2);
		}, e.prototype.isDark = function() {
			return le(this.rgba) < .5;
		}, e.prototype.isLight = function() {
			return le(this.rgba) >= .5;
		}, e.prototype.toHex = function() {
			return e = D(this.rgba), t = e.r, n = e.g, r = e.b, a = (i = e.a) < 1 ? k(C(255 * i)) : "", "#" + k(t) + k(n) + k(r) + a;
			var e, t, n, r, i, a;
		}, e.prototype.toRgb = function() {
			return D(this.rgba);
		}, e.prototype.toRgbString = function() {
			return e = D(this.rgba), t = e.r, n = e.g, r = e.b, (i = e.a) < 1 ? "rgba(" + t + ", " + n + ", " + r + ", " + i + ")" : "rgb(" + t + ", " + n + ", " + r + ")";
			var e, t, n, r, i;
		}, e.prototype.toHsl = function() {
			return N(te(this.rgba));
		}, e.prototype.toHslString = function() {
			return e = N(te(this.rgba)), t = e.h, n = e.s, r = e.l, (i = e.a) < 1 ? "hsla(" + t + ", " + n + "%, " + r + "%, " + i + ")" : "hsl(" + t + ", " + n + "%, " + r + "%)";
			var e, t, n, r, i;
		}, e.prototype.toHsv = function() {
			return e = A(this.rgba), {
				h: C(e.h),
				s: C(e.s),
				v: C(e.v),
				a: C(e.a, 3)
			};
			var e;
		}, e.prototype.invert = function() {
			return fe({
				r: 255 - (e = this.rgba).r,
				g: 255 - e.g,
				b: 255 - e.b,
				a: e.a
			});
			var e;
		}, e.prototype.saturate = function(e) {
			return e === void 0 && (e = .1), fe(ce(this.rgba, e));
		}, e.prototype.desaturate = function(e) {
			return e === void 0 && (e = .1), fe(ce(this.rgba, -e));
		}, e.prototype.grayscale = function() {
			return fe(ce(this.rgba, -1));
		}, e.prototype.lighten = function(e) {
			return e === void 0 && (e = .1), fe(ue(this.rgba, e));
		}, e.prototype.darken = function(e) {
			return e === void 0 && (e = .1), fe(ue(this.rgba, -e));
		}, e.prototype.rotate = function(e) {
			return e === void 0 && (e = 15), this.hue(this.hue() + e);
		}, e.prototype.alpha = function(e) {
			return typeof e == "number" ? fe({
				r: (t = this.rgba).r,
				g: t.g,
				b: t.b,
				a: e
			}) : C(this.rgba.a, 3);
			var t;
		}, e.prototype.hue = function(e) {
			var t = te(this.rgba);
			return typeof e == "number" ? fe({
				h: e,
				s: t.s,
				l: t.l,
				a: t.a
			}) : C(t.h);
		}, e.prototype.isEqual = function(e) {
			return this.toHex() === fe(e).toHex();
		}, e;
	}(), fe = function(e) {
		return e instanceof de ? e : new de(e);
	}, pe = [], me = function(e) {
		e.forEach(function(e) {
			pe.indexOf(e) < 0 && (e(de, ae), pe.push(e));
		});
	};
}));
//#endregion
//#region node_modules/@pixi/colord/plugins/names.mjs
function ge(e, t) {
	var n = {
		white: "#ffffff",
		bisque: "#ffe4c4",
		blue: "#0000ff",
		cadetblue: "#5f9ea0",
		chartreuse: "#7fff00",
		chocolate: "#d2691e",
		coral: "#ff7f50",
		antiquewhite: "#faebd7",
		aqua: "#00ffff",
		azure: "#f0ffff",
		whitesmoke: "#f5f5f5",
		papayawhip: "#ffefd5",
		plum: "#dda0dd",
		blanchedalmond: "#ffebcd",
		black: "#000000",
		gold: "#ffd700",
		goldenrod: "#daa520",
		gainsboro: "#dcdcdc",
		cornsilk: "#fff8dc",
		cornflowerblue: "#6495ed",
		burlywood: "#deb887",
		aquamarine: "#7fffd4",
		beige: "#f5f5dc",
		crimson: "#dc143c",
		cyan: "#00ffff",
		darkblue: "#00008b",
		darkcyan: "#008b8b",
		darkgoldenrod: "#b8860b",
		darkkhaki: "#bdb76b",
		darkgray: "#a9a9a9",
		darkgreen: "#006400",
		darkgrey: "#a9a9a9",
		peachpuff: "#ffdab9",
		darkmagenta: "#8b008b",
		darkred: "#8b0000",
		darkorchid: "#9932cc",
		darkorange: "#ff8c00",
		darkslateblue: "#483d8b",
		gray: "#808080",
		darkslategray: "#2f4f4f",
		darkslategrey: "#2f4f4f",
		deeppink: "#ff1493",
		deepskyblue: "#00bfff",
		wheat: "#f5deb3",
		firebrick: "#b22222",
		floralwhite: "#fffaf0",
		ghostwhite: "#f8f8ff",
		darkviolet: "#9400d3",
		magenta: "#ff00ff",
		green: "#008000",
		dodgerblue: "#1e90ff",
		grey: "#808080",
		honeydew: "#f0fff0",
		hotpink: "#ff69b4",
		blueviolet: "#8a2be2",
		forestgreen: "#228b22",
		lawngreen: "#7cfc00",
		indianred: "#cd5c5c",
		indigo: "#4b0082",
		fuchsia: "#ff00ff",
		brown: "#a52a2a",
		maroon: "#800000",
		mediumblue: "#0000cd",
		lightcoral: "#f08080",
		darkturquoise: "#00ced1",
		lightcyan: "#e0ffff",
		ivory: "#fffff0",
		lightyellow: "#ffffe0",
		lightsalmon: "#ffa07a",
		lightseagreen: "#20b2aa",
		linen: "#faf0e6",
		mediumaquamarine: "#66cdaa",
		lemonchiffon: "#fffacd",
		lime: "#00ff00",
		khaki: "#f0e68c",
		mediumseagreen: "#3cb371",
		limegreen: "#32cd32",
		mediumspringgreen: "#00fa9a",
		lightskyblue: "#87cefa",
		lightblue: "#add8e6",
		midnightblue: "#191970",
		lightpink: "#ffb6c1",
		mistyrose: "#ffe4e1",
		moccasin: "#ffe4b5",
		mintcream: "#f5fffa",
		lightslategray: "#778899",
		lightslategrey: "#778899",
		navajowhite: "#ffdead",
		navy: "#000080",
		mediumvioletred: "#c71585",
		powderblue: "#b0e0e6",
		palegoldenrod: "#eee8aa",
		oldlace: "#fdf5e6",
		paleturquoise: "#afeeee",
		mediumturquoise: "#48d1cc",
		mediumorchid: "#ba55d3",
		rebeccapurple: "#663399",
		lightsteelblue: "#b0c4de",
		mediumslateblue: "#7b68ee",
		thistle: "#d8bfd8",
		tan: "#d2b48c",
		orchid: "#da70d6",
		mediumpurple: "#9370db",
		purple: "#800080",
		pink: "#ffc0cb",
		skyblue: "#87ceeb",
		springgreen: "#00ff7f",
		palegreen: "#98fb98",
		red: "#ff0000",
		yellow: "#ffff00",
		slateblue: "#6a5acd",
		lavenderblush: "#fff0f5",
		peru: "#cd853f",
		palevioletred: "#db7093",
		violet: "#ee82ee",
		teal: "#008080",
		slategray: "#708090",
		slategrey: "#708090",
		aliceblue: "#f0f8ff",
		darkseagreen: "#8fbc8f",
		darkolivegreen: "#556b2f",
		greenyellow: "#adff2f",
		seagreen: "#2e8b57",
		seashell: "#fff5ee",
		tomato: "#ff6347",
		silver: "#c0c0c0",
		sienna: "#a0522d",
		lavender: "#e6e6fa",
		lightgreen: "#90ee90",
		orange: "#ffa500",
		orangered: "#ff4500",
		steelblue: "#4682b4",
		royalblue: "#4169e1",
		turquoise: "#40e0d0",
		yellowgreen: "#9acd32",
		salmon: "#fa8072",
		saddlebrown: "#8b4513",
		sandybrown: "#f4a460",
		rosybrown: "#bc8f8f",
		darksalmon: "#e9967a",
		lightgoldenrodyellow: "#fafad2",
		snow: "#fffafa",
		lightgrey: "#d3d3d3",
		lightgray: "#d3d3d3",
		dimgray: "#696969",
		dimgrey: "#696969",
		olivedrab: "#6b8e23",
		olive: "#808000"
	}, r = {};
	for (var i in n) r[n[i]] = i;
	var a = {};
	e.prototype.toName = function(t) {
		if (!(this.rgba.a || this.rgba.r || this.rgba.g || this.rgba.b)) return "transparent";
		var i, o, s = r[this.toHex()];
		if (s) return s;
		if (t?.closest) {
			var c = this.toRgb(), l = Infinity, u = "black";
			if (!a.length) for (var d in n) a[d] = new e(n[d]).toRgb();
			for (var f in n) {
				var p = (i = c, o = a[f], (i.r - o.r) ** 2 + (i.g - o.g) ** 2 + (i.b - o.b) ** 2);
				p < l && (l = p, u = f);
			}
			return u;
		}
	}, t.string.push([function(t) {
		var r = t.toLowerCase(), i = r === "transparent" ? "#0000" : n[r];
		return i ? new e(i).toRgb() : null;
	}, "name"]);
}
var _e = o((() => {})), ve, F, ye = o((() => {
	he(), _e(), me([ge]), ve = class e {
		constructor(e = 16777215) {
			this._value = null, this._components = new Float32Array(4), this._components.fill(1), this._int = 16777215, this.value = e;
		}
		get red() {
			return this._components[0];
		}
		get green() {
			return this._components[1];
		}
		get blue() {
			return this._components[2];
		}
		get alpha() {
			return this._components[3];
		}
		setValue(e) {
			return this.value = e, this;
		}
		set value(t) {
			if (t instanceof e) this._value = this._cloneSource(t._value), this._int = t._int, this._components.set(t._components);
			else if (t === null) throw Error("Cannot set Color#value to null");
			else (this._value === null || !this._isSourceEqual(this._value, t)) && (this._value = this._cloneSource(t), this._normalize(this._value));
		}
		get value() {
			return this._value;
		}
		_cloneSource(e) {
			return typeof e == "string" || typeof e == "number" || e instanceof Number || e === null ? e : Array.isArray(e) || ArrayBuffer.isView(e) ? e.slice(0) : typeof e == "object" && e ? { ...e } : e;
		}
		_isSourceEqual(e, t) {
			let n = typeof e;
			if (n !== typeof t) return !1;
			if (n === "number" || n === "string" || e instanceof Number) return e === t;
			if (Array.isArray(e) && Array.isArray(t) || ArrayBuffer.isView(e) && ArrayBuffer.isView(t)) return e.length === t.length ? e.every((e, n) => e === t[n]) : !1;
			if (e !== null && t !== null) {
				let n = Object.keys(e), r = Object.keys(t);
				return n.length === r.length ? n.every((n) => e[n] === t[n]) : !1;
			}
			return e === t;
		}
		toRgba() {
			let [e, t, n, r] = this._components;
			return {
				r: e,
				g: t,
				b: n,
				a: r
			};
		}
		toRgb() {
			let [e, t, n] = this._components;
			return {
				r: e,
				g: t,
				b: n
			};
		}
		toRgbaString() {
			let [e, t, n] = this.toUint8RgbArray();
			return `rgba(${e},${t},${n},${this.alpha})`;
		}
		toUint8RgbArray(e) {
			let [t, n, r] = this._components;
			return this._arrayRgb || (this._arrayRgb = []), e || (e = this._arrayRgb), e[0] = Math.round(t * 255), e[1] = Math.round(n * 255), e[2] = Math.round(r * 255), e;
		}
		toArray(e) {
			this._arrayRgba || (this._arrayRgba = []), e || (e = this._arrayRgba);
			let [t, n, r, i] = this._components;
			return e[0] = t, e[1] = n, e[2] = r, e[3] = i, e;
		}
		toRgbArray(e) {
			this._arrayRgb || (this._arrayRgb = []), e || (e = this._arrayRgb);
			let [t, n, r] = this._components;
			return e[0] = t, e[1] = n, e[2] = r, e;
		}
		toNumber() {
			return this._int;
		}
		toBgrNumber() {
			let [e, t, n] = this.toUint8RgbArray();
			return (n << 16) + (t << 8) + e;
		}
		toLittleEndianNumber() {
			let e = this._int;
			return (e >> 16) + (e & 65280) + ((e & 255) << 16);
		}
		multiply(t) {
			let [n, r, i, a] = e._temp.setValue(t)._components;
			return this._components[0] *= n, this._components[1] *= r, this._components[2] *= i, this._components[3] *= a, this._refreshInt(), this._value = null, this;
		}
		premultiply(e, t = !0) {
			return t && (this._components[0] *= e, this._components[1] *= e, this._components[2] *= e), this._components[3] = e, this._refreshInt(), this._value = null, this;
		}
		toPremultiplied(e, t = !0) {
			if (e === 1) return (255 << 24) + this._int;
			if (e === 0) return t ? 0 : this._int;
			let n = this._int >> 16 & 255, r = this._int >> 8 & 255, i = this._int & 255;
			return t && (n = n * e + .5 | 0, r = r * e + .5 | 0, i = i * e + .5 | 0), (e * 255 << 24) + (n << 16) + (r << 8) + i;
		}
		toHex() {
			let e = this._int.toString(16);
			return `#${"000000".substring(0, 6 - e.length) + e}`;
		}
		toHexa() {
			let e = Math.round(this._components[3] * 255).toString(16);
			return this.toHex() + "00".substring(0, 2 - e.length) + e;
		}
		setAlpha(e) {
			return this._components[3] = this._clamp(e), this._value = null, this;
		}
		_normalize(t) {
			let n, r, i, a;
			if ((typeof t == "number" || t instanceof Number) && t >= 0 && t <= 16777215) {
				let e = t;
				n = (e >> 16 & 255) / 255, r = (e >> 8 & 255) / 255, i = (e & 255) / 255, a = 1;
			} else if ((Array.isArray(t) || t instanceof Float32Array) && t.length >= 3 && t.length <= 4) t = this._clamp(t), [n, r, i, a = 1] = t;
			else if ((t instanceof Uint8Array || t instanceof Uint8ClampedArray) && t.length >= 3 && t.length <= 4) t = this._clamp(t, 0, 255), [n, r, i, a = 255] = t, n /= 255, r /= 255, i /= 255, a /= 255;
			else if (typeof t == "string" || typeof t == "object") {
				if (typeof t == "string") {
					let n = e.HEX_PATTERN.exec(t);
					n && (t = `#${n[2]}`);
				}
				let o = fe(t);
				o.isValid() && ({r: n, g: r, b: i, a} = o.rgba, n /= 255, r /= 255, i /= 255);
			}
			if (n !== void 0) this._components[0] = n, this._components[1] = r, this._components[2] = i, this._components[3] = a, this._refreshInt();
			else throw Error(`Unable to convert color ${t}`);
		}
		_refreshInt() {
			this._clamp(this._components);
			let [e, t, n] = this._components;
			this._int = (e * 255 << 16) + (t * 255 << 8) + (n * 255 | 0);
		}
		_clamp(e, t = 0, n = 1) {
			return typeof e == "number" ? Math.min(Math.max(e, t), n) : (e.forEach((r, i) => {
				e[i] = Math.min(Math.max(r, t), n);
			}), e);
		}
		static isColorLike(t) {
			return typeof t == "number" || typeof t == "string" || t instanceof Number || t instanceof e || Array.isArray(t) || t instanceof Uint8Array || t instanceof Uint8ClampedArray || t instanceof Float32Array || t.r !== void 0 && t.g !== void 0 && t.b !== void 0 || t.r !== void 0 && t.g !== void 0 && t.b !== void 0 && t.a !== void 0 || t.h !== void 0 && t.s !== void 0 && t.l !== void 0 || t.h !== void 0 && t.s !== void 0 && t.l !== void 0 && t.a !== void 0 || t.h !== void 0 && t.s !== void 0 && t.v !== void 0 || t.h !== void 0 && t.s !== void 0 && t.v !== void 0 && t.a !== void 0;
		}
	}, ve.shared = new ve(), ve._temp = new ve(), ve.HEX_PATTERN = /^(#|0x)?(([a-f0-9]{3}){1,2}([a-f0-9]{2})?)$/i, F = ve;
})), be, xe = o((() => {
	be = {
		cullArea: null,
		cullable: !1,
		cullableChildren: !0
	};
})), Se, Ce, we, Te = o((() => {
	Se = Math.PI * 2, Ce = 180 / Math.PI, we = Math.PI / 180;
})), I, Ee, De = o((() => {
	I = class e {
		constructor(e = 0, t = 0) {
			this.x = 0, this.y = 0, this.x = e, this.y = t;
		}
		clone() {
			return new e(this.x, this.y);
		}
		copyFrom(e) {
			return this.set(e.x, e.y), this;
		}
		copyTo(e) {
			return e.set(this.x, this.y), e;
		}
		equals(e) {
			return e.x === this.x && e.y === this.y;
		}
		set(e = 0, t = e) {
			return this.x = e, this.y = t, this;
		}
		toString() {
			return `[pixi.js/math:Point x=${this.x} y=${this.y}]`;
		}
		static get shared() {
			return Ee.x = 0, Ee.y = 0, Ee;
		}
	}, Ee = new I();
})), L, Oe, ke, R = o((() => {
	Te(), De(), L = class e {
		constructor(e = 1, t = 0, n = 0, r = 1, i = 0, a = 0) {
			this.array = null, this.a = e, this.b = t, this.c = n, this.d = r, this.tx = i, this.ty = a;
		}
		fromArray(e) {
			this.a = e[0], this.b = e[1], this.c = e[3], this.d = e[4], this.tx = e[2], this.ty = e[5];
		}
		set(e, t, n, r, i, a) {
			return this.a = e, this.b = t, this.c = n, this.d = r, this.tx = i, this.ty = a, this;
		}
		toArray(e, t) {
			this.array || (this.array = new Float32Array(9));
			let n = t || this.array;
			return e ? (n[0] = this.a, n[1] = this.b, n[2] = 0, n[3] = this.c, n[4] = this.d, n[5] = 0, n[6] = this.tx, n[7] = this.ty, n[8] = 1) : (n[0] = this.a, n[1] = this.c, n[2] = this.tx, n[3] = this.b, n[4] = this.d, n[5] = this.ty, n[6] = 0, n[7] = 0, n[8] = 1), n;
		}
		apply(e, t) {
			t = t || new I();
			let n = e.x, r = e.y;
			return t.x = this.a * n + this.c * r + this.tx, t.y = this.b * n + this.d * r + this.ty, t;
		}
		applyInverse(e, t) {
			t = t || new I();
			let n = this.a, r = this.b, i = this.c, a = this.d, o = this.tx, s = this.ty, c = 1 / (n * a + i * -r), l = e.x, u = e.y;
			return t.x = a * c * l + -i * c * u + (s * i - o * a) * c, t.y = n * c * u + -r * c * l + (-s * n + o * r) * c, t;
		}
		translate(e, t) {
			return this.tx += e, this.ty += t, this;
		}
		scale(e, t) {
			return this.a *= e, this.d *= t, this.c *= e, this.b *= t, this.tx *= e, this.ty *= t, this;
		}
		rotate(e) {
			let t = Math.cos(e), n = Math.sin(e), r = this.a, i = this.c, a = this.tx;
			return this.a = r * t - this.b * n, this.b = r * n + this.b * t, this.c = i * t - this.d * n, this.d = i * n + this.d * t, this.tx = a * t - this.ty * n, this.ty = a * n + this.ty * t, this;
		}
		append(e) {
			let t = this.a, n = this.b, r = this.c, i = this.d;
			return this.a = e.a * t + e.b * r, this.b = e.a * n + e.b * i, this.c = e.c * t + e.d * r, this.d = e.c * n + e.d * i, this.tx = e.tx * t + e.ty * r + this.tx, this.ty = e.tx * n + e.ty * i + this.ty, this;
		}
		appendFrom(e, t) {
			let n = e.a, r = e.b, i = e.c, a = e.d, o = e.tx, s = e.ty, c = t.a, l = t.b, u = t.c, d = t.d;
			return this.a = n * c + r * u, this.b = n * l + r * d, this.c = i * c + a * u, this.d = i * l + a * d, this.tx = o * c + s * u + t.tx, this.ty = o * l + s * d + t.ty, this;
		}
		setTransform(e, t, n, r, i, a, o, s, c) {
			return this.a = Math.cos(o + c) * i, this.b = Math.sin(o + c) * i, this.c = -Math.sin(o - s) * a, this.d = Math.cos(o - s) * a, this.tx = e - (n * this.a + r * this.c), this.ty = t - (n * this.b + r * this.d), this;
		}
		prepend(e) {
			let t = this.tx;
			if (e.a !== 1 || e.b !== 0 || e.c !== 0 || e.d !== 1) {
				let t = this.a, n = this.c;
				this.a = t * e.a + this.b * e.c, this.b = t * e.b + this.b * e.d, this.c = n * e.a + this.d * e.c, this.d = n * e.b + this.d * e.d;
			}
			return this.tx = t * e.a + this.ty * e.c + e.tx, this.ty = t * e.b + this.ty * e.d + e.ty, this;
		}
		decompose(e) {
			let t = this.a, n = this.b, r = this.c, i = this.d, a = e.pivot, o = -Math.atan2(-r, i), s = Math.atan2(n, t), c = Math.abs(o + s);
			return c < 1e-5 || Math.abs(Se - c) < 1e-5 ? (e.rotation = s, e.skew.x = e.skew.y = 0) : (e.rotation = 0, e.skew.x = o, e.skew.y = s), e.scale.x = Math.sqrt(t * t + n * n), e.scale.y = Math.sqrt(r * r + i * i), e.position.x = this.tx + (a.x * t + a.y * r), e.position.y = this.ty + (a.x * n + a.y * i), e;
		}
		invert() {
			let e = this.a, t = this.b, n = this.c, r = this.d, i = this.tx, a = e * r - t * n;
			return this.a = r / a, this.b = -t / a, this.c = -n / a, this.d = e / a, this.tx = (n * this.ty - r * i) / a, this.ty = -(e * this.ty - t * i) / a, this;
		}
		isIdentity() {
			return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.tx === 0 && this.ty === 0;
		}
		identity() {
			return this.a = 1, this.b = 0, this.c = 0, this.d = 1, this.tx = 0, this.ty = 0, this;
		}
		clone() {
			let t = new e();
			return t.a = this.a, t.b = this.b, t.c = this.c, t.d = this.d, t.tx = this.tx, t.ty = this.ty, t;
		}
		copyTo(e) {
			return e.a = this.a, e.b = this.b, e.c = this.c, e.d = this.d, e.tx = this.tx, e.ty = this.ty, e;
		}
		copyFrom(e) {
			return this.a = e.a, this.b = e.b, this.c = e.c, this.d = e.d, this.tx = e.tx, this.ty = e.ty, this;
		}
		equals(e) {
			return e.a === this.a && e.b === this.b && e.c === this.c && e.d === this.d && e.tx === this.tx && e.ty === this.ty;
		}
		toString() {
			return `[pixi.js:Matrix a=${this.a} b=${this.b} c=${this.c} d=${this.d} tx=${this.tx} ty=${this.ty}]`;
		}
		static get IDENTITY() {
			return ke.identity();
		}
		static get shared() {
			return Oe.identity();
		}
	}, Oe = new L(), ke = new L();
})), Ae, je = o((() => {
	Ae = class e {
		constructor(e, t, n) {
			this._x = t || 0, this._y = n || 0, this._observer = e;
		}
		clone(t) {
			return new e(t ?? this._observer, this._x, this._y);
		}
		set(e = 0, t = e) {
			return (this._x !== e || this._y !== t) && (this._x = e, this._y = t, this._observer._onUpdate(this)), this;
		}
		copyFrom(e) {
			return (this._x !== e.x || this._y !== e.y) && (this._x = e.x, this._y = e.y, this._observer._onUpdate(this)), this;
		}
		copyTo(e) {
			return e.set(this._x, this._y), e;
		}
		equals(e) {
			return e.x === this._x && e.y === this._y;
		}
		toString() {
			return `[pixi.js/math:ObservablePoint x=${this._x} y=${this._y} scope=${this._observer}]`;
		}
		get x() {
			return this._x;
		}
		set x(e) {
			this._x !== e && (this._x = e, this._observer._onUpdate(this));
		}
		get y() {
			return this._y;
		}
		set y(e) {
			this._y !== e && (this._y = e, this._observer._onUpdate(this));
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/data/uid.mjs
function z(e = "default") {
	return Me[e] === void 0 && (Me[e] = -1), ++Me[e];
}
var Me, Ne = o((() => {
	Me = { default: -1 };
})), Pe, B, Fe, Ie, V, Le = o((() => {
	Pe = /* @__PURE__ */ new Set(), B = "8.0.0", Fe = "8.3.4", Ie = {
		quiet: !1,
		noColor: !1
	}, V = ((e, t, n = 3) => {
		if (Ie.quiet || Pe.has(t)) return;
		let r = (/* @__PURE__ */ Error()).stack, i = `${t}
Deprecated since v${e}`, a = typeof console.groupCollapsed == "function" && !Ie.noColor;
		r === void 0 ? console.warn("PixiJS Deprecation Warning: ", i) : (r = r.split("\n").splice(n).join("\n"), a ? (console.groupCollapsed("%cPixiJS Deprecation Warning: %c%s", "color:#614108;background:#fffbe6", "font-weight:normal;color:#614108;background:#fffbe6", i), console.warn(r), console.groupEnd()) : (console.warn("PixiJS Deprecation Warning: ", i), console.warn(r))), Pe.add(t);
	}), Object.defineProperties(V, {
		quiet: {
			get: () => Ie.quiet,
			set: (e) => {
				Ie.quiet = e;
			},
			enumerable: !0,
			configurable: !1
		},
		noColor: {
			get: () => Ie.noColor,
			set: (e) => {
				Ie.noColor = e;
			},
			enumerable: !0,
			configurable: !1
		}
	});
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/logging/warn.mjs
function H(...e) {
	Re !== ze && (Re++, Re === ze ? console.warn("PixiJS Warning: too many warnings, no more warnings will be reported to the console by PixiJS.") : console.warn("PixiJS Warning: ", ...e));
}
var Re, ze, U = o((() => {
	Re = 0, ze = 500;
})), Be, Ve = o((() => {
	Be = {
		_registeredResources: /* @__PURE__ */ new Set(),
		register(e) {
			this._registeredResources.add(e);
		},
		unregister(e) {
			this._registeredResources.delete(e);
		},
		release() {
			this._registeredResources.forEach((e) => e.clear());
		},
		get registeredCount() {
			return this._registeredResources.size;
		},
		isRegistered(e) {
			return this._registeredResources.has(e);
		},
		reset() {
			this._registeredResources.clear();
		}
	};
})), He, Ue = o((() => {
	He = class {
		constructor(e, t) {
			this._pool = [], this._count = 0, this._index = 0, this._classType = e, t && this.prepopulate(t);
		}
		prepopulate(e) {
			for (let t = 0; t < e; t++) this._pool[this._index++] = new this._classType();
			this._count += e;
		}
		get(e) {
			let t;
			return this._index > 0 ? t = this._pool[--this._index] : (t = new this._classType(), this._count++), t.init?.(e), t;
		}
		return(e) {
			e.reset?.(), this._pool[this._index++] = e;
		}
		get totalSize() {
			return this._count;
		}
		get totalFree() {
			return this._index;
		}
		get totalUsed() {
			return this._count - this._index;
		}
		clear() {
			if (this._pool.length > 0 && this._pool[0].destroy) for (let e = 0; e < this._index; e++) this._pool[e].destroy();
			this._pool.length = 0, this._count = 0, this._index = 0;
		}
	};
})), We, Ge, Ke = o((() => {
	Ve(), Ue(), We = class {
		constructor() {
			this._poolsByClass = /* @__PURE__ */ new Map();
		}
		prepopulate(e, t) {
			this.getPool(e).prepopulate(t);
		}
		get(e, t) {
			return this.getPool(e).get(t);
		}
		return(e) {
			this.getPool(e.constructor).return(e);
		}
		getPool(e) {
			return this._poolsByClass.has(e) || this._poolsByClass.set(e, new He(e)), this._poolsByClass.get(e);
		}
		stats() {
			let e = {};
			return this._poolsByClass.forEach((t) => {
				let n = e[t._classType.name] ? t._classType.name + t._classType.ID : t._classType.name;
				e[n] = {
					free: t.totalFree,
					used: t.totalUsed,
					size: t.totalSize
				};
			}), e;
		}
		clear() {
			this._poolsByClass.forEach((e) => e.clear()), this._poolsByClass.clear();
		}
	}, Ge = new We(), Be.register(Ge);
})), qe, Je = o((() => {
	Le(), qe = {
		get isCachedAsTexture() {
			return !!this.renderGroup?.isCachedAsTexture;
		},
		cacheAsTexture(e) {
			typeof e == "boolean" && e === !1 ? this.disableRenderGroup() : (this.enableRenderGroup(), this.renderGroup.enableCacheAsTexture(e === !0 ? {} : e));
		},
		updateCacheTexture() {
			this.renderGroup?.updateCacheTexture();
		},
		get cacheAsBitmap() {
			return this.isCachedAsTexture;
		},
		set cacheAsBitmap(e) {
			V("v8.6.0", "cacheAsBitmap is deprecated, use cacheAsTexture instead."), this.cacheAsTexture(e);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/data/removeItems.mjs
function Ye(e, t, n) {
	let r = e.length, i;
	if (t >= r || n === 0) return;
	n = t + n > r ? r - t : n;
	let a = r - n;
	for (i = t; i < a; ++i) e[i] = e[i + n];
	e.length = a;
}
var Xe = o((() => {})), Ze, Qe = o((() => {
	Xe(), Le(), Ze = {
		allowChildren: !0,
		removeChildren(e = 0, t) {
			let n = t ?? this.children.length, r = n - e, i = [];
			if (r > 0 && r <= n) {
				for (let t = n - 1; t >= e; t--) {
					let e = this.children[t];
					e && (i.push(e), e.parent = null);
				}
				Ye(this.children, e, n);
				let t = this.renderGroup || this.parentRenderGroup;
				t && t.removeChildren(i);
				for (let e = 0; e < i.length; ++e) {
					let t = i[e];
					t.parentRenderLayer?.detach(t), this.emit("childRemoved", t, this, e), i[e].emit("removed", this);
				}
				return i.length > 0 && this._didViewChangeTick++, i;
			} else if (r === 0 && this.children.length === 0) return i;
			throw RangeError("removeChildren: numeric values are outside the acceptable range.");
		},
		removeChildAt(e) {
			let t = this.getChildAt(e);
			return this.removeChild(t);
		},
		getChildAt(e) {
			if (e < 0 || e >= this.children.length) throw Error(`getChildAt: Index (${e}) does not exist.`);
			return this.children[e];
		},
		setChildIndex(e, t) {
			if (t < 0 || t >= this.children.length) throw Error(`The index ${t} supplied is out of bounds ${this.children.length}`);
			this.getChildIndex(e), this.addChildAt(e, t);
		},
		getChildIndex(e) {
			let t = this.children.indexOf(e);
			if (t === -1) throw Error("The supplied Container must be a child of the caller");
			return t;
		},
		addChildAt(e, t) {
			this.allowChildren || V(B, "addChildAt: Only Containers will be allowed to add children in v8.0.0");
			let { children: n } = this;
			if (t < 0 || t > n.length) throw Error(`${e}addChildAt: The index ${t} supplied is out of bounds ${n.length}`);
			let r = e.parent === this;
			if (e.parent) {
				let n = e.parent.children.indexOf(e);
				if (r) {
					if (n === t) return e;
					e.parent.children.splice(n, 1);
				} else e.removeFromParent();
			}
			t === n.length ? n.push(e) : n.splice(t, 0, e), e.parent = this, e.didChange = !0, e._updateFlags = 15;
			let i = this.renderGroup || this.parentRenderGroup;
			return i && i.addChild(e), this.sortableChildren && (this.sortDirty = !0), r ? e : (this.emit("childAdded", e, this, t), e.emit("added", this), e);
		},
		swapChildren(e, t) {
			if (e === t) return;
			let n = this.getChildIndex(e), r = this.getChildIndex(t);
			this.children[n] = t, this.children[r] = e;
			let i = this.renderGroup || this.parentRenderGroup;
			i && (i.structureDidChange = !0), this._didContainerChangeTick++;
		},
		removeFromParent() {
			this.parent?.removeChild(this);
		},
		reparentChild(...e) {
			return e.length === 1 ? this.reparentChildAt(e[0], this.children.length) : (e.forEach((e) => this.reparentChildAt(e, this.children.length)), e[0]);
		},
		reparentChildAt(e, t) {
			if (e.parent === this) return this.setChildIndex(e, t), e;
			let n = e.worldTransform.clone();
			e.removeFromParent(), this.addChildAt(e, t);
			let r = this.worldTransform.clone();
			return r.invert(), n.prepend(r), e.setFromMatrix(n), e;
		},
		replaceChild(e, t) {
			e.updateLocalTransform(), this.addChildAt(t, this.getChildIndex(e)), t.setFromMatrix(e.localTransform), t.updateLocalTransform(), this.removeChild(e);
		}
	};
})), $e, et = o((() => {
	$e = {
		collectRenderables(e, t, n) {
			this.parentRenderLayer && this.parentRenderLayer !== n || this.globalDisplayStatus < 7 || !this.includeInBuild || (this.sortableChildren && this.sortChildren(), this.isSimple ? this.collectRenderablesSimple(e, t, n) : this.renderGroup ? t.renderPipes.renderGroup.addRenderGroup(this.renderGroup, e) : this.collectRenderablesWithEffects(e, t, n));
		},
		collectRenderablesSimple(e, t, n) {
			let r = this.children, i = r.length;
			for (let a = 0; a < i; a++) r[a].collectRenderables(e, t, n);
		},
		collectRenderablesWithEffects(e, t, n) {
			let { renderPipes: r } = t;
			for (let t = 0; t < this.effects.length; t++) {
				let n = this.effects[t];
				r[n.pipe].push(n, this, e);
			}
			this.collectRenderablesSimple(e, t, n);
			for (let t = this.effects.length - 1; t >= 0; t--) {
				let n = this.effects[t];
				r[n.pipe].pop(n, this, e);
			}
		}
	};
})), tt, nt = o((() => {
	tt = class {
		constructor() {
			this.pipe = "filter", this.priority = 1;
		}
		destroy() {
			for (let e = 0; e < this.filters.length; e++) this.filters[e].destroy();
			this.filters = null, this.filterArea = null;
		}
	};
})), rt, it, at = o((() => {
	g(), Ke(), rt = class {
		constructor() {
			this._effectClasses = [], this._tests = [], this._initialized = !1;
		}
		init() {
			this._initialized || (this._initialized = !0, this._effectClasses.forEach((e) => {
				this.add({
					test: e.test,
					maskClass: e
				});
			}));
		}
		add(e) {
			this._tests.push(e);
		}
		getMaskEffect(e) {
			this._initialized || this.init();
			for (let t = 0; t < this._tests.length; t++) {
				let n = this._tests[t];
				if (n.test(e)) return Ge.get(n.maskClass, e);
			}
			return e;
		}
		returnMaskEffect(e) {
			Ge.return(e);
		}
	}, it = new rt(), h.handleByList(f.MaskEffect, it._effectClasses);
})), ot, st = o((() => {
	nt(), at(), ot = {
		_maskEffect: null,
		_maskOptions: { inverse: !1 },
		_filterEffect: null,
		effects: [],
		_markStructureAsChanged() {
			let e = this.renderGroup || this.parentRenderGroup;
			e && (e.structureDidChange = !0);
		},
		addEffect(e) {
			this.effects.indexOf(e) === -1 && (this.effects.push(e), this.effects.sort((e, t) => e.priority - t.priority), this._markStructureAsChanged(), this._updateIsSimple());
		},
		removeEffect(e) {
			let t = this.effects.indexOf(e);
			t !== -1 && (this.effects.splice(t, 1), this._markStructureAsChanged(), this._updateIsSimple());
		},
		set mask(e) {
			let t = this._maskEffect;
			t?.mask !== e && (t && (this.removeEffect(t), it.returnMaskEffect(t), this._maskEffect = null), e != null && (this._maskEffect = it.getMaskEffect(e), this.addEffect(this._maskEffect)));
		},
		get mask() {
			return this._maskEffect?.mask;
		},
		setMask(e) {
			this._maskOptions = {
				...this._maskOptions,
				...e
			}, e.mask && (this.mask = e.mask), this._markStructureAsChanged();
		},
		set filters(e) {
			!Array.isArray(e) && e && (e = [e]);
			let t = this._filterEffect || (this._filterEffect = new tt());
			e = e;
			let n = e?.length > 0, r = n !== t.filters?.length > 0;
			e = Array.isArray(e) ? e.slice(0) : e, t.filters = Object.freeze(e), r && (n ? this.addEffect(t) : (this.removeEffect(t), t.filters = e ?? null));
		},
		get filters() {
			return this._filterEffect?.filters;
		},
		set filterArea(e) {
			this._filterEffect || (this._filterEffect = new tt()), this._filterEffect.filterArea = e;
		},
		get filterArea() {
			return this._filterEffect?.filterArea;
		}
	};
})), ct, lt = o((() => {
	Le(), ct = {
		label: null,
		get name() {
			return V(B, "Container.name property has been removed, use Container.label instead"), this.label;
		},
		set name(e) {
			V(B, "Container.name property has been removed, use Container.label instead"), this.label = e;
		},
		getChildByName(e, t = !1) {
			return this.getChildByLabel(e, t);
		},
		getChildByLabel(e, t = !1) {
			let n = this.children;
			for (let t = 0; t < n.length; t++) {
				let r = n[t];
				if (r.label === e || e instanceof RegExp && e.test(r.label)) return r;
			}
			if (t) for (let t = 0; t < n.length; t++) {
				let r = n[t].getChildByLabel(e, !0);
				if (r) return r;
			}
			return null;
		},
		getChildrenByLabel(e, t = !1, n = []) {
			let r = this.children;
			for (let t = 0; t < r.length; t++) {
				let i = r[t];
				(i.label === e || e instanceof RegExp && e.test(i.label)) && n.push(i);
			}
			if (t) for (let t = 0; t < r.length; t++) r[t].getChildrenByLabel(e, !0, n);
			return n;
		}
	};
})), ut, W, dt = o((() => {
	De(), ut = [
		new I(),
		new I(),
		new I(),
		new I()
	], W = class e {
		constructor(e = 0, t = 0, n = 0, r = 0) {
			this.type = "rectangle", this.x = Number(e), this.y = Number(t), this.width = Number(n), this.height = Number(r);
		}
		get left() {
			return this.x;
		}
		get right() {
			return this.x + this.width;
		}
		get top() {
			return this.y;
		}
		get bottom() {
			return this.y + this.height;
		}
		isEmpty() {
			return this.left === this.right || this.top === this.bottom;
		}
		static get EMPTY() {
			return new e(0, 0, 0, 0);
		}
		clone() {
			return new e(this.x, this.y, this.width, this.height);
		}
		copyFromBounds(e) {
			return this.x = e.minX, this.y = e.minY, this.width = e.maxX - e.minX, this.height = e.maxY - e.minY, this;
		}
		copyFrom(e) {
			return this.x = e.x, this.y = e.y, this.width = e.width, this.height = e.height, this;
		}
		copyTo(e) {
			return e.copyFrom(this), e;
		}
		contains(e, t) {
			return this.width <= 0 || this.height <= 0 ? !1 : e >= this.x && e < this.x + this.width && t >= this.y && t < this.y + this.height;
		}
		strokeContains(e, t, n, r = .5) {
			let { width: i, height: a } = this;
			if (i <= 0 || a <= 0) return !1;
			let o = this.x, s = this.y, c = n * (1 - r), l = n - c, u = o - c, d = o + i + c, f = s - c, p = s + a + c, m = o + l, h = o + i - l, g = s + l, _ = s + a - l;
			return e >= u && e <= d && t >= f && t <= p && !(e > m && e < h && t > g && t < _);
		}
		intersects(e, t) {
			if (!t) {
				let t = this.x < e.x ? e.x : this.x;
				if ((this.right > e.right ? e.right : this.right) <= t) return !1;
				let n = this.y < e.y ? e.y : this.y;
				return (this.bottom > e.bottom ? e.bottom : this.bottom) > n;
			}
			let n = this.left, r = this.right, i = this.top, a = this.bottom;
			if (r <= n || a <= i) return !1;
			let o = ut[0].set(e.left, e.top), s = ut[1].set(e.left, e.bottom), c = ut[2].set(e.right, e.top), l = ut[3].set(e.right, e.bottom);
			if (c.x <= o.x || s.y <= o.y) return !1;
			let u = Math.sign(t.a * t.d - t.b * t.c);
			if (u === 0 || (t.apply(o, o), t.apply(s, s), t.apply(c, c), t.apply(l, l), Math.max(o.x, s.x, c.x, l.x) <= n || Math.min(o.x, s.x, c.x, l.x) >= r || Math.max(o.y, s.y, c.y, l.y) <= i || Math.min(o.y, s.y, c.y, l.y) >= a)) return !1;
			let d = u * (s.y - o.y), f = u * (o.x - s.x), p = d * n + f * i, m = d * r + f * i, h = d * n + f * a, g = d * r + f * a;
			if (Math.max(p, m, h, g) <= d * o.x + f * o.y || Math.min(p, m, h, g) >= d * l.x + f * l.y) return !1;
			let _ = u * (o.y - c.y), v = u * (c.x - o.x), y = _ * n + v * i, b = _ * r + v * i, x = _ * n + v * a, S = _ * r + v * a;
			return !(Math.max(y, b, x, S) <= _ * o.x + v * o.y || Math.min(y, b, x, S) >= _ * l.x + v * l.y);
		}
		pad(e = 0, t = e) {
			return this.x -= e, this.y -= t, this.width += e * 2, this.height += t * 2, this;
		}
		fit(e) {
			let t = Math.max(this.x, e.x), n = Math.min(this.x + this.width, e.x + e.width), r = Math.max(this.y, e.y), i = Math.min(this.y + this.height, e.y + e.height);
			return this.x = t, this.width = Math.max(n - t, 0), this.y = r, this.height = Math.max(i - r, 0), this;
		}
		ceil(e = 1, t = .001) {
			let n = Math.ceil((this.x + this.width - t) * e) / e, r = Math.ceil((this.y + this.height - t) * e) / e;
			return this.x = Math.floor((this.x + t) * e) / e, this.y = Math.floor((this.y + t) * e) / e, this.width = n - this.x, this.height = r - this.y, this;
		}
		scale(e, t = e) {
			return this.x *= e, this.y *= t, this.width *= e, this.height *= t, this;
		}
		enlarge(e) {
			let t = Math.min(this.x, e.x), n = Math.max(this.x + this.width, e.x + e.width), r = Math.min(this.y, e.y), i = Math.max(this.y + this.height, e.y + e.height);
			return this.x = t, this.width = n - t, this.y = r, this.height = i - r, this;
		}
		getBounds(t) {
			return t || (t = new e()), t.copyFrom(this), t;
		}
		containsRect(e) {
			if (this.width <= 0 || this.height <= 0) return !1;
			let t = e.x, n = e.y, r = e.x + e.width, i = e.y + e.height;
			return t >= this.x && t < this.x + this.width && n >= this.y && n < this.y + this.height && r >= this.x && r < this.x + this.width && i >= this.y && i < this.y + this.height;
		}
		set(e, t, n, r) {
			return this.x = e, this.y = t, this.width = n, this.height = r, this;
		}
		toString() {
			return `[pixi.js/math:Rectangle x=${this.x} y=${this.y} width=${this.width} height=${this.height}]`;
		}
	};
})), ft, pt, mt = o((() => {
	R(), dt(), ft = new L(), pt = class e {
		constructor(e = Infinity, t = Infinity, n = -Infinity, r = -Infinity) {
			this.minX = Infinity, this.minY = Infinity, this.maxX = -Infinity, this.maxY = -Infinity, this.matrix = ft, this.minX = e, this.minY = t, this.maxX = n, this.maxY = r;
		}
		isEmpty() {
			return this.minX > this.maxX || this.minY > this.maxY;
		}
		get rectangle() {
			this._rectangle || (this._rectangle = new W());
			let e = this._rectangle;
			return this.minX > this.maxX || this.minY > this.maxY ? (e.x = 0, e.y = 0, e.width = 0, e.height = 0) : e.copyFromBounds(this), e;
		}
		clear() {
			return this.minX = Infinity, this.minY = Infinity, this.maxX = -Infinity, this.maxY = -Infinity, this.matrix = ft, this;
		}
		set(e, t, n, r) {
			this.minX = e, this.minY = t, this.maxX = n, this.maxY = r;
		}
		addFrame(e, t, n, r, i) {
			i || (i = this.matrix);
			let a = i.a, o = i.b, s = i.c, c = i.d, l = i.tx, u = i.ty, d = this.minX, f = this.minY, p = this.maxX, m = this.maxY, h = a * e + s * t + l, g = o * e + c * t + u;
			h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * n + s * t + l, g = o * n + c * t + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * e + s * r + l, g = o * e + c * r + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), h = a * n + s * r + l, g = o * n + c * r + u, h < d && (d = h), g < f && (f = g), h > p && (p = h), g > m && (m = g), this.minX = d, this.minY = f, this.maxX = p, this.maxY = m;
		}
		addRect(e, t) {
			this.addFrame(e.x, e.y, e.x + e.width, e.y + e.height, t);
		}
		addBounds(e, t) {
			this.addFrame(e.minX, e.minY, e.maxX, e.maxY, t);
		}
		addBoundsMask(e) {
			this.minX = this.minX > e.minX ? this.minX : e.minX, this.minY = this.minY > e.minY ? this.minY : e.minY, this.maxX = this.maxX < e.maxX ? this.maxX : e.maxX, this.maxY = this.maxY < e.maxY ? this.maxY : e.maxY;
		}
		applyMatrix(e) {
			let t = this.minX, n = this.minY, r = this.maxX, i = this.maxY, { a, b: o, c: s, d: c, tx: l, ty: u } = e, d = a * t + s * n + l, f = o * t + c * n + u;
			this.minX = d, this.minY = f, this.maxX = d, this.maxY = f, d = a * r + s * n + l, f = o * r + c * n + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY, d = a * t + s * i + l, f = o * t + c * i + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY, d = a * r + s * i + l, f = o * r + c * i + u, this.minX = d < this.minX ? d : this.minX, this.minY = f < this.minY ? f : this.minY, this.maxX = d > this.maxX ? d : this.maxX, this.maxY = f > this.maxY ? f : this.maxY;
		}
		fit(e) {
			return this.minX < e.left && (this.minX = e.left), this.maxX > e.right && (this.maxX = e.right), this.minY < e.top && (this.minY = e.top), this.maxY > e.bottom && (this.maxY = e.bottom), this;
		}
		fitBounds(e, t, n, r) {
			return this.minX < e && (this.minX = e), this.maxX > t && (this.maxX = t), this.minY < n && (this.minY = n), this.maxY > r && (this.maxY = r), this;
		}
		pad(e, t = e) {
			return this.minX -= e, this.maxX += e, this.minY -= t, this.maxY += t, this;
		}
		ceil() {
			return this.minX = Math.floor(this.minX), this.minY = Math.floor(this.minY), this.maxX = Math.ceil(this.maxX), this.maxY = Math.ceil(this.maxY), this;
		}
		clone() {
			return new e(this.minX, this.minY, this.maxX, this.maxY);
		}
		scale(e, t = e) {
			return this.minX *= e, this.minY *= t, this.maxX *= e, this.maxY *= t, this;
		}
		get x() {
			return this.minX;
		}
		set x(e) {
			let t = this.maxX - this.minX;
			this.minX = e, this.maxX = e + t;
		}
		get y() {
			return this.minY;
		}
		set y(e) {
			let t = this.maxY - this.minY;
			this.minY = e, this.maxY = e + t;
		}
		get width() {
			return this.maxX - this.minX;
		}
		set width(e) {
			this.maxX = this.minX + e;
		}
		get height() {
			return this.maxY - this.minY;
		}
		set height(e) {
			this.maxY = this.minY + e;
		}
		get left() {
			return this.minX;
		}
		get right() {
			return this.maxX;
		}
		get top() {
			return this.minY;
		}
		get bottom() {
			return this.maxY;
		}
		get isPositive() {
			return this.maxX - this.minX > 0 && this.maxY - this.minY > 0;
		}
		get isValid() {
			return this.minX + this.minY !== Infinity;
		}
		addVertexData(e, t, n, r) {
			let i = this.minX, a = this.minY, o = this.maxX, s = this.maxY;
			r || (r = this.matrix);
			let c = r.a, l = r.b, u = r.c, d = r.d, f = r.tx, p = r.ty;
			for (let r = t; r < n; r += 2) {
				let t = e[r], n = e[r + 1], m = c * t + u * n + f, h = l * t + d * n + p;
				i = m < i ? m : i, a = h < a ? h : a, o = m > o ? m : o, s = h > s ? h : s;
			}
			this.minX = i, this.minY = a, this.maxX = o, this.maxY = s;
		}
		containsPoint(e, t) {
			return this.minX <= e && this.minY <= t && this.maxX >= e && this.maxY >= t;
		}
		toString() {
			return `[pixi.js:Bounds minX=${this.minX} minY=${this.minY} maxX=${this.maxX} maxY=${this.maxY} width=${this.width} height=${this.height}]`;
		}
		copyFrom(e) {
			return this.minX = e.minX, this.minY = e.minY, this.maxX = e.maxX, this.maxY = e.maxY, this;
		}
	};
})), ht, gt, _t = o((() => {
	R(), Ke(), mt(), ht = Ge.getPool(L), gt = Ge.getPool(pt);
})), vt, yt, bt = o((() => {
	R(), mt(), _t(), vt = new L(), yt = {
		getFastGlobalBounds(e, t) {
			t || (t = new pt()), t.clear(), this._getGlobalBoundsRecursive(!!e, t, this.parentRenderLayer), t.isValid || t.set(0, 0, 0, 0);
			let n = this.renderGroup || this.parentRenderGroup;
			return t.applyMatrix(n.worldTransform), t;
		},
		_getGlobalBoundsRecursive(e, t, n) {
			let r = t;
			if (e && this.parentRenderLayer && this.parentRenderLayer !== n || this.localDisplayStatus !== 7 || !this.measurable) return;
			let i = !!this.effects.length;
			if ((this.renderGroup || i) && (r = gt.get().clear()), this.boundsArea) t.addRect(this.boundsArea, this.worldTransform);
			else {
				if (this.renderPipeId) {
					let e = this.bounds;
					r.addFrame(e.minX, e.minY, e.maxX, e.maxY, this.groupTransform);
				}
				let t = this.children;
				for (let i = 0; i < t.length; i++) t[i]._getGlobalBoundsRecursive(e, r, n);
			}
			if (i) {
				let e = !1, n = this.renderGroup || this.parentRenderGroup;
				for (let t = 0; t < this.effects.length; t++) this.effects[t].addBounds && (e || (e = !0, r.applyMatrix(n.worldTransform)), this.effects[t].addBounds(r, !0));
				e && r.applyMatrix(n.worldTransform.copyTo(vt).invert()), t.addBounds(r), gt.return(r);
			} else this.renderGroup && (t.addBounds(r, this.relativeGroupTransform), gt.return(r));
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/bounds/getGlobalBounds.mjs
function xt(e, t, n) {
	n.clear();
	let r, i;
	return e.parent ? t ? r = e.parent.worldTransform : (i = ht.get().identity(), r = Ct(e, i)) : r = L.IDENTITY, St(e, n, r, t), i && ht.return(i), n.isValid || n.set(0, 0, 0, 0), n;
}
function St(e, t, n, r) {
	if (!e.visible || !e.measurable) return;
	let i;
	r ? i = e.worldTransform : (e.updateLocalTransform(), i = ht.get(), i.appendFrom(e.localTransform, n));
	let a = t, o = !!e.effects.length;
	if (o && (t = gt.get().clear()), e.boundsArea) t.addRect(e.boundsArea, i);
	else {
		let n = e.bounds;
		n && !n.isEmpty() && (t.matrix = i, t.addBounds(n));
		for (let n = 0; n < e.children.length; n++) St(e.children[n], t, i, r);
	}
	if (o) {
		for (let n = 0; n < e.effects.length; n++) e.effects[n].addBounds?.(t);
		a.addBounds(t, L.IDENTITY), gt.return(t);
	}
	r || ht.return(i);
}
function Ct(e, t) {
	let n = e.parent;
	return n && (Ct(n, t), n.updateLocalTransform(), t.append(n.localTransform)), t;
}
var wt = o((() => {
	R(), _t();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/multiplyHexColors.mjs
function Tt(e, t) {
	if (e === 16777215 || !t) return t;
	if (t === 16777215 || !e) return e;
	let n = e >> 16 & 255, r = e >> 8 & 255, i = e & 255, a = t >> 16 & 255, o = t >> 8 & 255, s = t & 255, c = n * a / 255 | 0, l = r * o / 255 | 0, u = i * s / 255 | 0;
	return (c << 16) + (l << 8) + u;
}
var Et = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/multiplyColors.mjs
function Dt(e, t) {
	return e === Ot ? t : t === Ot ? e : Tt(e, t);
}
var Ot, kt = o((() => {
	Et(), Ot = 16777215;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/container-mixins/getGlobalMixin.mjs
function At(e) {
	return ((e & 255) << 16) + (e & 65280) + (e >> 16 & 255);
}
var jt, Mt = o((() => {
	R(), wt(), _t(), kt(), jt = {
		getGlobalAlpha(e) {
			if (e) return this.renderGroup ? this.renderGroup.worldAlpha : this.parentRenderGroup ? this.parentRenderGroup.worldAlpha * this.alpha : this.alpha;
			let t = this.alpha, n = this.parent;
			for (; n;) t *= n.alpha, n = n.parent;
			return t;
		},
		getGlobalTransform(e = new L(), t) {
			if (t) return e.copyFrom(this.worldTransform);
			this.updateLocalTransform();
			let n = Ct(this, ht.get().identity());
			return e.appendFrom(this.localTransform, n), ht.return(n), e;
		},
		getGlobalTint(e) {
			if (e) return this.renderGroup ? At(this.renderGroup.worldColor) : this.parentRenderGroup ? At(Dt(this.localColor, this.parentRenderGroup.worldColor)) : this.tint;
			let t = this.localColor, n = this.parent;
			for (; n;) t = Dt(t, n.localColor), n = n.parent;
			return At(t);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/bounds/getLocalBounds.mjs
function Nt(e, t, n) {
	return t.clear(), n || (n = L.IDENTITY), Pt(e, t, n, e, !0), t.isValid || t.set(0, 0, 0, 0), t;
}
function Pt(e, t, n, r, i) {
	let a;
	if (i) a = ht.get(), a = n.copyTo(a);
	else {
		if (!e.visible || !e.measurable) return;
		e.updateLocalTransform();
		let t = e.localTransform;
		a = ht.get(), a.appendFrom(t, n);
	}
	let o = t, s = !!e.effects.length;
	if (s && (t = gt.get().clear()), e.boundsArea) t.addRect(e.boundsArea, a);
	else {
		e.renderPipeId && (t.matrix = a, t.addBounds(e.bounds));
		let n = e.children;
		for (let e = 0; e < n.length; e++) Pt(n[e], t, a, r, !1);
	}
	if (s) {
		for (let n = 0; n < e.effects.length; n++) e.effects[n].addLocalBounds?.(t, r);
		o.addBounds(t, L.IDENTITY), gt.return(t);
	}
	ht.return(a);
}
var Ft = o((() => {
	R(), _t();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/checkChildrenDidChange.mjs
function It(e, t) {
	let n = e.children;
	for (let e = 0; e < n.length; e++) {
		let r = n[e], i = r.uid, a = (r._didViewChangeTick & 65535) << 16 | r._didContainerChangeTick & 65535, o = t.index;
		(t.data[o] !== i || t.data[o + 1] !== a) && (t.data[t.index] = i, t.data[t.index + 1] = a, t.didChange = !0), t.index = o + 2, r.children.length && It(r, t);
	}
	return t.didChange;
}
var Lt = o((() => {})), Rt, zt, Bt = o((() => {
	R(), mt(), wt(), Ft(), Lt(), Rt = new L(), zt = {
		_localBoundsCacheId: -1,
		_localBoundsCacheData: null,
		_setWidth(e, t) {
			let n = Math.sign(this.scale.x) || 1;
			t === 0 ? this.scale.x = n : this.scale.x = e / t * n;
		},
		_setHeight(e, t) {
			let n = Math.sign(this.scale.y) || 1;
			t === 0 ? this.scale.y = n : this.scale.y = e / t * n;
		},
		getLocalBounds() {
			this._localBoundsCacheData || (this._localBoundsCacheData = {
				data: [],
				index: 1,
				didChange: !1,
				localBounds: new pt()
			});
			let e = this._localBoundsCacheData;
			return e.index = 1, e.didChange = !1, e.data[0] !== this._didViewChangeTick && (e.didChange = !0, e.data[0] = this._didViewChangeTick), It(this, e), e.didChange && Nt(this, e.localBounds, Rt), e.localBounds;
		},
		getBounds(e, t) {
			return xt(this, e, t || new pt());
		}
	};
})), Vt, Ht = o((() => {
	Vt = {
		_onRender: null,
		set onRender(e) {
			let t = this.renderGroup || this.parentRenderGroup;
			if (!e) {
				this._onRender && t?.removeOnRender(this), this._onRender = null;
				return;
			}
			this._onRender || t?.addOnRender(this), this._onRender = e;
		},
		get onRender() {
			return this._onRender;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/container-mixins/sortMixin.mjs
function Ut(e, t) {
	return e._zIndex - t._zIndex;
}
var Wt, Gt = o((() => {
	Wt = {
		_zIndex: 0,
		sortDirty: !1,
		sortableChildren: !1,
		get zIndex() {
			return this._zIndex;
		},
		set zIndex(e) {
			this._zIndex !== e && (this._zIndex = e, this.depthOfChildModified());
		},
		depthOfChildModified() {
			this.parent && (this.parent.sortableChildren = !0, this.parent.sortDirty = !0), this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0);
		},
		sortChildren() {
			this.sortDirty && (this.sortDirty = !1, this.children.sort(Ut));
		}
	};
})), Kt, qt = o((() => {
	De(), _t(), Kt = {
		getGlobalPosition(e = new I(), t = !1) {
			return this.parent ? this.parent.toGlobal(this._position, e, t) : (e.x = this._position.x, e.y = this._position.y), e;
		},
		toGlobal(e, t, n = !1) {
			let r = this.getGlobalTransform(ht.get(), n);
			return t = r.apply(e, t), ht.return(r), t;
		},
		toLocal(e, t, n, r) {
			t && (e = t.toGlobal(e, n, r));
			let i = this.getGlobalTransform(ht.get(), r);
			return n = i.applyInverse(e, n), ht.return(i), n;
		}
	};
})), Jt, Yt = o((() => {
	Ne(), Jt = class {
		constructor() {
			this.uid = z("instructionSet"), this.instructions = [], this.instructionSize = 0, this.renderables = [], this.gcTick = 0;
		}
		reset() {
			this.instructionSize = 0;
		}
		destroy() {
			this.instructions.length = 0, this.renderables.length = 0, this.renderPipes = null, this.gcTick = 0;
		}
		add(e) {
			this.instructions[this.instructionSize++] = e;
		}
		log() {
			this.instructions.length = this.instructionSize, console.table(this.instructions, ["type", "action"]);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/maths/misc/pow2.mjs
function Xt(e) {
	return e += e === 0 ? 1 : 0, --e, e |= e >>> 1, e |= e >>> 2, e |= e >>> 4, e |= e >>> 8, e |= e >>> 16, e + 1;
}
function Zt(e) {
	return !(e & e - 1) && !!e;
}
var Qt = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/definedProps.mjs
function $t(e) {
	let t = {};
	for (let n in e) e[n] !== void 0 && (t[n] = e[n]);
	return t;
}
var en = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/texture/TextureStyle.mjs
function tn(e) {
	let t = nn[e];
	return t === void 0 && (nn[e] = z("resource")), t;
}
var nn, rn, an, on = o((() => {
	b(), Ne(), Le(), nn = /* @__PURE__ */ Object.create(null), rn = class e extends y {
		constructor(t = {}) {
			super(), this._resourceType = "textureSampler", this._touched = 0, this._maxAnisotropy = 1, this.destroyed = !1, t = {
				...e.defaultOptions,
				...t
			}, this.addressMode = t.addressMode, this.addressModeU = t.addressModeU ?? this.addressModeU, this.addressModeV = t.addressModeV ?? this.addressModeV, this.addressModeW = t.addressModeW ?? this.addressModeW, this.scaleMode = t.scaleMode, this.magFilter = t.magFilter ?? this.magFilter, this.minFilter = t.minFilter ?? this.minFilter, this.mipmapFilter = t.mipmapFilter ?? this.mipmapFilter, this.lodMinClamp = t.lodMinClamp, this.lodMaxClamp = t.lodMaxClamp, this.compare = t.compare, this.maxAnisotropy = t.maxAnisotropy ?? 1;
		}
		set addressMode(e) {
			this.addressModeU = e, this.addressModeV = e, this.addressModeW = e;
		}
		get addressMode() {
			return this.addressModeU;
		}
		set wrapMode(e) {
			V(B, "TextureStyle.wrapMode is now TextureStyle.addressMode"), this.addressMode = e;
		}
		get wrapMode() {
			return this.addressMode;
		}
		set scaleMode(e) {
			this.magFilter = e, this.minFilter = e, this.mipmapFilter = e;
		}
		get scaleMode() {
			return this.magFilter;
		}
		set maxAnisotropy(e) {
			this._maxAnisotropy = Math.min(e, 16), this._maxAnisotropy > 1 && (this.scaleMode = "linear");
		}
		get maxAnisotropy() {
			return this._maxAnisotropy;
		}
		get _resourceId() {
			return this._sharedResourceId || this._generateResourceId();
		}
		update() {
			this._sharedResourceId = null, this.emit("change", this);
		}
		_generateResourceId() {
			return this._sharedResourceId = tn(`${this.addressModeU}-${this.addressModeV}-${this.addressModeW}-${this.magFilter}-${this.minFilter}-${this.mipmapFilter}-${this.lodMinClamp}-${this.lodMaxClamp}-${this.compare}-${this._maxAnisotropy}`), this._resourceId;
		}
		destroy() {
			this.destroyed = !0, this.emit("destroy", this), this.emit("change", this), this.removeAllListeners();
		}
	}, rn.defaultOptions = {
		addressMode: "clamp-to-edge",
		scaleMode: "linear"
	}, an = rn;
})), sn, cn, ln = o((() => {
	b(), Qt(), en(), Ne(), on(), sn = class e extends y {
		constructor(t = {}) {
			super(), this.options = t, this._gpuData = /* @__PURE__ */ Object.create(null), this._gcLastUsed = -1, this.uid = z("textureSource"), this._resourceType = "textureSource", this._resourceId = z("resource"), this.uploadMethodId = "unknown", this._resolution = 1, this.pixelWidth = 1, this.pixelHeight = 1, this.width = 1, this.height = 1, this.sampleCount = 1, this.mipLevelCount = 1, this.autoGenerateMipmaps = !1, this.format = "rgba8unorm", this.dimension = "2d", this.viewDimension = "2d", this.arrayLayerCount = 1, this.antialias = !1, this._touched = 0, this._batchTick = -1, this._textureBindLocation = -1, t = {
				...e.defaultOptions,
				...t
			}, this.label = t.label ?? "", this.resource = t.resource, this.autoGarbageCollect = t.autoGarbageCollect, this._resolution = t.resolution, t.width ? this.pixelWidth = t.width * this._resolution : this.pixelWidth = this.resource ? this.resourceWidth ?? 1 : 1, t.height ? this.pixelHeight = t.height * this._resolution : this.pixelHeight = this.resource ? this.resourceHeight ?? 1 : 1, this.width = this.pixelWidth / this._resolution, this.height = this.pixelHeight / this._resolution, this.format = t.format, this.dimension = t.dimensions, this.viewDimension = t.viewDimension ?? t.dimensions, this.arrayLayerCount = t.arrayLayerCount, this.mipLevelCount = t.mipLevelCount, this.autoGenerateMipmaps = t.autoGenerateMipmaps, this.sampleCount = t.sampleCount, this.antialias = t.antialias, this.alphaMode = t.alphaMode, this.style = new an($t(t)), this.destroyed = !1, this._refreshPOT();
		}
		get source() {
			return this;
		}
		get style() {
			return this._style;
		}
		set style(e) {
			this.style !== e && (this._style?.off("change", this._onStyleChange, this), this._style = e, this._style?.on("change", this._onStyleChange, this), this._onStyleChange());
		}
		set maxAnisotropy(e) {
			this._style.maxAnisotropy = e;
		}
		get maxAnisotropy() {
			return this._style.maxAnisotropy;
		}
		get addressMode() {
			return this._style.addressMode;
		}
		set addressMode(e) {
			this._style.addressMode = e;
		}
		get repeatMode() {
			return this._style.addressMode;
		}
		set repeatMode(e) {
			this._style.addressMode = e;
		}
		get magFilter() {
			return this._style.magFilter;
		}
		set magFilter(e) {
			this._style.magFilter = e;
		}
		get minFilter() {
			return this._style.minFilter;
		}
		set minFilter(e) {
			this._style.minFilter = e;
		}
		get mipmapFilter() {
			return this._style.mipmapFilter;
		}
		set mipmapFilter(e) {
			this._style.mipmapFilter = e;
		}
		get lodMinClamp() {
			return this._style.lodMinClamp;
		}
		set lodMinClamp(e) {
			this._style.lodMinClamp = e;
		}
		get lodMaxClamp() {
			return this._style.lodMaxClamp;
		}
		set lodMaxClamp(e) {
			this._style.lodMaxClamp = e;
		}
		_onStyleChange() {
			this.emit("styleChange", this);
		}
		update() {
			if (this.resource) {
				let e = this._resolution;
				if (this.resize(this.resourceWidth / e, this.resourceHeight / e)) return;
			}
			this.emit("update", this);
		}
		destroy() {
			this.destroyed = !0, this.unload(), this.emit("destroy", this), this._style && (this._style.destroy(), this._style = null), this.uploadMethodId = null, this.resource = null, this.removeAllListeners();
		}
		unload() {
			this._resourceId = z("resource"), this.emit("change", this), this.emit("unload", this);
			for (let e in this._gpuData) this._gpuData[e]?.destroy?.();
			this._gpuData = /* @__PURE__ */ Object.create(null);
		}
		get resourceWidth() {
			let { resource: e } = this;
			return e.naturalWidth || e.videoWidth || e.displayWidth || e.width;
		}
		get resourceHeight() {
			let { resource: e } = this;
			return e.naturalHeight || e.videoHeight || e.displayHeight || e.height;
		}
		get resolution() {
			return this._resolution;
		}
		set resolution(e) {
			this._resolution !== e && (this._resolution = e, this.width = this.pixelWidth / e, this.height = this.pixelHeight / e);
		}
		resize(e, t, n) {
			n || (n = this._resolution), e || (e = this.width), t || (t = this.height);
			let r = Math.round(e * n), i = Math.round(t * n);
			return this.width = r / n, this.height = i / n, this._resolution = n, this.pixelWidth === r && this.pixelHeight === i ? !1 : (this._refreshPOT(), this.pixelWidth = r, this.pixelHeight = i, this.emit("resize", this), this._resourceId = z("resource"), this.emit("change", this), !0);
		}
		updateMipmaps() {
			this.autoGenerateMipmaps && this.mipLevelCount > 1 && this.emit("updateMipmaps", this);
		}
		set wrapMode(e) {
			this._style.wrapMode = e;
		}
		get wrapMode() {
			return this._style.wrapMode;
		}
		set scaleMode(e) {
			this._style.scaleMode = e;
		}
		get scaleMode() {
			return this._style.scaleMode;
		}
		_refreshPOT() {
			this.isPowerOfTwo = Zt(this.pixelWidth) && Zt(this.pixelHeight);
		}
		static test(e) {
			throw Error("Unimplemented");
		}
	}, sn.defaultOptions = {
		resolution: 1,
		format: "bgra8unorm",
		alphaMode: "premultiply-alpha-on-upload",
		dimensions: "2d",
		viewDimension: "2d",
		arrayLayerCount: 1,
		mipLevelCount: 1,
		autoGenerateMipmaps: !1,
		sampleCount: 1,
		antialias: !1,
		autoGarbageCollect: !1
	}, cn = sn;
}));
//#endregion
//#region node_modules/pixi.js/lib/maths/matrix/groupD8.mjs
function un() {
	for (let e = 0; e < 16; e++) {
		let t = [];
		hn.push(t);
		for (let n = 0; n < 16; n++) {
			let r = _n(dn[e] * dn[n] + pn[e] * fn[n]), i = _n(fn[e] * dn[n] + mn[e] * fn[n]), a = _n(dn[e] * pn[n] + pn[e] * mn[n]), o = _n(fn[e] * pn[n] + mn[e] * mn[n]);
			for (let e = 0; e < 16; e++) if (dn[e] === r && fn[e] === i && pn[e] === a && mn[e] === o) {
				t.push(e);
				break;
			}
		}
	}
	for (let e = 0; e < 16; e++) {
		let t = new L();
		t.set(dn[e], fn[e], pn[e], mn[e], 0, 0), gn.push(t);
	}
}
var dn, fn, pn, mn, hn, gn, _n, G, vn = o((() => {
	R(), dn = [
		1,
		1,
		0,
		-1,
		-1,
		-1,
		0,
		1,
		1,
		1,
		0,
		-1,
		-1,
		-1,
		0,
		1
	], fn = [
		0,
		1,
		1,
		1,
		0,
		-1,
		-1,
		-1,
		0,
		1,
		1,
		1,
		0,
		-1,
		-1,
		-1
	], pn = [
		0,
		-1,
		-1,
		-1,
		0,
		1,
		1,
		1,
		0,
		1,
		1,
		1,
		0,
		-1,
		-1,
		-1
	], mn = [
		1,
		1,
		0,
		-1,
		-1,
		-1,
		0,
		1,
		-1,
		-1,
		0,
		1,
		1,
		1,
		0,
		-1
	], hn = [], gn = [], _n = Math.sign, un(), G = {
		E: 0,
		SE: 1,
		S: 2,
		SW: 3,
		W: 4,
		NW: 5,
		N: 6,
		NE: 7,
		MIRROR_VERTICAL: 8,
		MAIN_DIAGONAL: 10,
		MIRROR_HORIZONTAL: 12,
		REVERSE_DIAGONAL: 14,
		uX: (e) => dn[e],
		uY: (e) => fn[e],
		vX: (e) => pn[e],
		vY: (e) => mn[e],
		inv: (e) => e & 8 ? e & 15 : -e & 7,
		add: (e, t) => hn[e][t],
		sub: (e, t) => hn[e][G.inv(t)],
		rotate180: (e) => e ^ 4,
		isVertical: (e) => (e & 3) == 2,
		byDirection: (e, t) => Math.abs(e) * 2 <= Math.abs(t) ? t >= 0 ? G.S : G.N : Math.abs(t) * 2 <= Math.abs(e) ? e > 0 ? G.E : G.W : t > 0 ? e > 0 ? G.SE : G.SW : e > 0 ? G.NE : G.NW,
		matrixAppendRotationInv: (e, t, n = 0, r = 0, i = 0, a = 0) => {
			let o = gn[G.inv(t)], s = o.a, c = o.b, l = o.c, u = o.d, d = n - Math.min(0, s * i, l * a, s * i + l * a), f = r - Math.min(0, c * i, u * a, c * i + u * a), p = e.a, m = e.b, h = e.c, g = e.d;
			e.a = s * p + c * h, e.b = s * m + c * g, e.c = l * p + u * h, e.d = l * m + u * g, e.tx = d * p + f * h + e.tx, e.ty = d * m + f * g + e.ty;
		},
		transformRectCoords: (e, t, n, r) => {
			let { x: i, y: a, width: o, height: s } = e, { x: c, y: l, width: u, height: d } = t;
			return n === G.E ? (r.set(i + c, a + l, o, s), r) : n === G.S ? r.set(u - a - s + c, i + l, s, o) : n === G.W ? r.set(u - i - o + c, d - a - s + l, o, s) : n === G.N ? r.set(a + c, d - i - o + l, s, o) : r.set(i + c, a + l, o, s);
		}
	};
})), yn, bn = o((() => {
	yn = () => {};
})), xn, Sn = o((() => {
	g(), ln(), xn = class extends cn {
		constructor(e) {
			let t = e.resource || new Float32Array(e.width * e.height * 4), n = e.format;
			n || (n = t instanceof Float32Array ? "rgba32float" : t instanceof Int32Array || t instanceof Uint32Array ? "rgba32uint" : t instanceof Int16Array || t instanceof Uint16Array ? "rgba16uint" : (t instanceof Int8Array, "bgra8unorm")), super({
				...e,
				resource: t,
				format: n
			}), this.uploadMethodId = "buffer";
		}
		static test(e) {
			return e instanceof Int8Array || e instanceof Uint8Array || e instanceof Uint8ClampedArray || e instanceof Int16Array || e instanceof Uint16Array || e instanceof Int32Array || e instanceof Uint32Array || e instanceof Float32Array;
		}
	}, xn.extension = f.TextureSource;
})), Cn, wn, Tn = o((() => {
	R(), Cn = new L(), wn = class {
		constructor(e, t) {
			this.mapCoord = new L(), this.uClampFrame = new Float32Array(4), this.uClampOffset = new Float32Array(2), this._textureID = -1, this._updateID = 0, this.clampOffset = 0, t === void 0 ? this.clampMargin = e.width < 10 ? 0 : .5 : this.clampMargin = t, this.isSimple = !1, this.texture = e;
		}
		get texture() {
			return this._texture;
		}
		set texture(e) {
			this.texture !== e && (this._texture?.removeListener("update", this.update, this), this._texture = e, this._texture.addListener("update", this.update, this), this.update());
		}
		multiplyUvs(e, t) {
			t === void 0 && (t = e);
			let n = this.mapCoord;
			for (let r = 0; r < e.length; r += 2) {
				let i = e[r], a = e[r + 1];
				t[r] = i * n.a + a * n.c + n.tx, t[r + 1] = i * n.b + a * n.d + n.ty;
			}
			return t;
		}
		update() {
			let e = this._texture;
			this._updateID++;
			let t = e.uvs;
			this.mapCoord.set(t.x1 - t.x0, t.y1 - t.y0, t.x3 - t.x0, t.y3 - t.y0, t.x0, t.y0);
			let n = e.orig, r = e.trim;
			r && (Cn.set(n.width / r.width, 0, 0, n.height / r.height, -r.x / r.width, -r.y / r.height), this.mapCoord.append(Cn));
			let i = e.source, a = this.uClampFrame, o = this.clampMargin / i._resolution, s = this.clampOffset / i._resolution;
			return a[0] = (e.frame.x + o + s) / i.width, a[1] = (e.frame.y + o + s) / i.height, a[2] = (e.frame.x + e.frame.width - o + s) / i.width, a[3] = (e.frame.y + e.frame.height - o + s) / i.height, this.uClampOffset[0] = this.clampOffset / i.pixelWidth, this.uClampOffset[1] = this.clampOffset / i.pixelHeight, this.isSimple = e.frame.width === i.width && e.frame.height === i.height && e.rotate === 0, !0;
		}
	};
})), K, q = o((() => {
	b(), vn(), dt(), Ne(), Le(), bn(), Sn(), ln(), Tn(), K = class extends y {
		constructor({ source: e, label: t, frame: n, orig: r, trim: i, defaultAnchor: a, defaultBorders: o, rotate: s, dynamic: c } = {}) {
			if (super(), this.uid = z("texture"), this.uvs = {
				x0: 0,
				y0: 0,
				x1: 0,
				y1: 0,
				x2: 0,
				y2: 0,
				x3: 0,
				y3: 0
			}, this.frame = new W(), this.noFrame = !1, this.dynamic = !1, this.isTexture = !0, this.label = t, this.source = e?.source ?? new cn(), this.noFrame = !n, n) this.frame.copyFrom(n);
			else {
				let { width: e, height: t } = this._source;
				this.frame.width = e, this.frame.height = t;
			}
			this.orig = r || this.frame, this.trim = i, this.rotate = s ?? 0, this.defaultAnchor = a, this.defaultBorders = o, this.destroyed = !1, this.dynamic = c || !1, this.updateUvs();
		}
		set source(e) {
			this._source && this._source.off("resize", this.update, this), this._source = e, e.on("resize", this.update, this), this.emit("update", this);
		}
		get source() {
			return this._source;
		}
		get textureMatrix() {
			return this._textureMatrix || (this._textureMatrix = new wn(this)), this._textureMatrix;
		}
		get width() {
			return this.orig.width;
		}
		get height() {
			return this.orig.height;
		}
		updateUvs() {
			let { uvs: e, frame: t } = this, { width: n, height: r } = this._source, i = t.x / n, a = t.y / r, o = t.width / n, s = t.height / r, c = this.rotate;
			if (c) {
				let t = o / 2, n = s / 2, r = i + t, l = a + n;
				c = G.add(c, G.NW), e.x0 = r + t * G.uX(c), e.y0 = l + n * G.uY(c), c = G.add(c, 2), e.x1 = r + t * G.uX(c), e.y1 = l + n * G.uY(c), c = G.add(c, 2), e.x2 = r + t * G.uX(c), e.y2 = l + n * G.uY(c), c = G.add(c, 2), e.x3 = r + t * G.uX(c), e.y3 = l + n * G.uY(c);
			} else e.x0 = i, e.y0 = a, e.x1 = i + o, e.y1 = a, e.x2 = i + o, e.y2 = a + s, e.x3 = i, e.y3 = a + s;
		}
		destroy(e = !1) {
			this._source && (this._source.off("resize", this.update, this), e && (this._source.destroy(), this._source = null)), this._textureMatrix = null, this.destroyed = !0, this.emit("destroy", this), this.removeAllListeners();
		}
		update() {
			this.noFrame && (this.frame.width = this._source.width, this.frame.height = this._source.height), this.updateUvs(), this.emit("update", this);
		}
		get baseTexture() {
			return V(B, "Texture.baseTexture is now Texture.source"), this._source;
		}
	}, K.EMPTY = new K({
		label: "EMPTY",
		source: new cn({ label: "EMPTY" })
	}), K.EMPTY.destroy = yn, K.WHITE = new K({
		source: new xn({
			resource: new Uint8Array([
				255,
				255,
				255,
				255
			]),
			width: 1,
			height: 1,
			alphaMode: "premultiply-alpha-on-upload",
			label: "WHITE"
		}),
		label: "WHITE"
	}), K.WHITE.destroy = yn;
})), En, Dn, On, kn = o((() => {
	Qt(), Ve(), ln(), q(), on(), En = 0, Dn = class {
		constructor(e) {
			this._poolKeyHash = /* @__PURE__ */ Object.create(null), this._texturePool = {}, this.textureOptions = e || {}, this.enableFullScreen = !1, this.textureStyle = new an(this.textureOptions);
		}
		createTexture(e, t, n, r) {
			return new K({
				source: new cn({
					...this.textureOptions,
					width: e,
					height: t,
					resolution: 1,
					antialias: n,
					autoGarbageCollect: !1,
					autoGenerateMipmaps: r
				}),
				label: `texturePool_${En++}`
			});
		}
		getOptimalTexture(e, t, n = 1, r, i = !1) {
			let a = Math.ceil(e * n - 1e-6), o = Math.ceil(t * n - 1e-6);
			a = Xt(a), o = Xt(o);
			let s = r ? 1 : 0, c = i ? 1 : 0, l = (a << 17) + (o << 2) + (c << 1) + s;
			this._texturePool[l] || (this._texturePool[l] = []);
			let u = this._texturePool[l].pop();
			return u || (u = this.createTexture(a, o, r, i)), u.source._resolution = n, u.source.width = a / n, u.source.height = o / n, u.source.pixelWidth = a, u.source.pixelHeight = o, u.frame.x = 0, u.frame.y = 0, u.frame.width = e, u.frame.height = t, u.updateUvs(), this._poolKeyHash[u.uid] = l, u;
		}
		getSameSizeTexture(e, t = !1) {
			let n = e.source;
			return this.getOptimalTexture(e.width, e.height, n._resolution, t);
		}
		returnTexture(e, t = !1) {
			let n = this._poolKeyHash[e.uid];
			t && (e.source.style = this.textureStyle), this._texturePool[n].push(e);
		}
		clear(e) {
			if (e = e !== !1, e) for (let e in this._texturePool) {
				let t = this._texturePool[e];
				if (t) for (let e = 0; e < t.length; e++) t[e].destroy(!0);
			}
			this._texturePool = {};
		}
	}, On = new Dn(), Be.register(On);
})), An, jn = o((() => {
	R(), Yt(), kn(), An = class {
		constructor() {
			this.renderPipeId = "renderGroup", this.root = null, this.canBundle = !1, this.renderGroupParent = null, this.renderGroupChildren = [], this.worldTransform = new L(), this.worldColorAlpha = 4294967295, this.worldColor = 16777215, this.worldAlpha = 1, this.childrenToUpdate = /* @__PURE__ */ Object.create(null), this.updateTick = 0, this.gcTick = 0, this.childrenRenderablesToUpdate = {
				list: [],
				index: 0
			}, this.structureDidChange = !0, this.instructionSet = new Jt(), this._onRenderContainers = [], this.textureNeedsUpdate = !0, this.isCachedAsTexture = !1, this._matrixDirty = 7;
		}
		init(e) {
			this.root = e, e._onRender && this.addOnRender(e), e.didChange = !0;
			let t = e.children;
			for (let e = 0; e < t.length; e++) {
				let n = t[e];
				n._updateFlags = 15, this.addChild(n);
			}
		}
		enableCacheAsTexture(e = {}) {
			this.textureOptions = e, this.isCachedAsTexture = !0, this.textureNeedsUpdate = !0;
		}
		disableCacheAsTexture() {
			this.isCachedAsTexture = !1, this.texture && (On.returnTexture(this.texture, !0), this.texture = null);
		}
		updateCacheTexture() {
			this.textureNeedsUpdate = !0;
			let e = this._parentCacheAsTextureRenderGroup;
			e && !e.textureNeedsUpdate && e.updateCacheTexture();
		}
		reset() {
			this.renderGroupChildren.length = 0;
			for (let e in this.childrenToUpdate) {
				let t = this.childrenToUpdate[e];
				t.list.fill(null), t.index = 0;
			}
			this.childrenRenderablesToUpdate.index = 0, this.childrenRenderablesToUpdate.list.fill(null), this.root = null, this.updateTick = 0, this.structureDidChange = !0, this._onRenderContainers.length = 0, this.renderGroupParent = null, this.disableCacheAsTexture();
		}
		get localTransform() {
			return this.root.localTransform;
		}
		addRenderGroupChild(e) {
			e.renderGroupParent && e.renderGroupParent._removeRenderGroupChild(e), e.renderGroupParent = this, this.renderGroupChildren.push(e);
		}
		_removeRenderGroupChild(e) {
			let t = this.renderGroupChildren.indexOf(e);
			t > -1 && this.renderGroupChildren.splice(t, 1), e.renderGroupParent = null;
		}
		addChild(e) {
			if (this.structureDidChange = !0, e.parentRenderGroup = this, e.updateTick = -1, e.parent === this.root ? e.relativeRenderGroupDepth = 1 : e.relativeRenderGroupDepth = e.parent.relativeRenderGroupDepth + 1, e.didChange = !0, this.onChildUpdate(e), e.renderGroup) {
				this.addRenderGroupChild(e.renderGroup);
				return;
			}
			e._onRender && this.addOnRender(e);
			let t = e.children;
			for (let e = 0; e < t.length; e++) this.addChild(t[e]);
		}
		removeChild(e) {
			if (this.structureDidChange = !0, e._onRender && (e.renderGroup || this.removeOnRender(e)), e.parentRenderGroup = null, e.renderGroup) {
				this._removeRenderGroupChild(e.renderGroup);
				return;
			}
			let t = e.children;
			for (let e = 0; e < t.length; e++) this.removeChild(t[e]);
		}
		removeChildren(e) {
			for (let t = 0; t < e.length; t++) this.removeChild(e[t]);
		}
		onChildUpdate(e) {
			let t = this.childrenToUpdate[e.relativeRenderGroupDepth];
			t || (t = this.childrenToUpdate[e.relativeRenderGroupDepth] = {
				index: 0,
				list: []
			}), t.list[t.index++] = e;
		}
		updateRenderable(e) {
			e.globalDisplayStatus < 7 || (this.instructionSet.renderPipes[e.renderPipeId].updateRenderable(e), e.didViewUpdate = !1);
		}
		onChildViewUpdate(e) {
			this.childrenRenderablesToUpdate.list[this.childrenRenderablesToUpdate.index++] = e;
		}
		get isRenderable() {
			return this.root.localDisplayStatus === 7 && this.worldAlpha > 0;
		}
		addOnRender(e) {
			this._onRenderContainers.push(e);
		}
		removeOnRender(e) {
			this._onRenderContainers.splice(this._onRenderContainers.indexOf(e), 1);
		}
		runOnRender(e) {
			for (let t = 0; t < this._onRenderContainers.length; t++) this._onRenderContainers[t]._onRender(e);
		}
		destroy() {
			this.disableCacheAsTexture(), this.renderGroupParent = null, this.root = null, this.childrenRenderablesToUpdate = null, this.childrenToUpdate = null, this.renderGroupChildren = null, this._onRenderContainers = null, this.instructionSet = null;
		}
		getChildren(e = []) {
			let t = this.root.children;
			for (let n = 0; n < t.length; n++) this._getChildren(t[n], e);
			return e;
		}
		_getChildren(e, t = []) {
			if (t.push(e), e.renderGroup) return t;
			let n = e.children;
			for (let e = 0; e < n.length; e++) this._getChildren(n[e], t);
			return t;
		}
		invalidateMatrices() {
			this._matrixDirty = 7;
		}
		get inverseWorldTransform() {
			return this._matrixDirty & 1 ? (this._matrixDirty &= -2, this._inverseWorldTransform || (this._inverseWorldTransform = new L()), this._inverseWorldTransform.copyFrom(this.worldTransform).invert()) : this._inverseWorldTransform;
		}
		get textureOffsetInverseTransform() {
			return this._matrixDirty & 2 ? (this._matrixDirty &= -3, this._textureOffsetInverseTransform || (this._textureOffsetInverseTransform = new L()), this._textureOffsetInverseTransform.copyFrom(this.inverseWorldTransform).translate(-this._textureBounds.x, -this._textureBounds.y)) : this._textureOffsetInverseTransform;
		}
		get inverseParentTextureTransform() {
			if (!(this._matrixDirty & 4)) return this._inverseParentTextureTransform;
			this._matrixDirty &= -5;
			let e = this._parentCacheAsTextureRenderGroup;
			return e ? (this._inverseParentTextureTransform || (this._inverseParentTextureTransform = new L()), this._inverseParentTextureTransform.copyFrom(this.worldTransform).prepend(e.inverseWorldTransform).translate(-e._textureBounds.x, -e._textureBounds.y)) : this.worldTransform;
		}
		get cacheToLocalTransform() {
			return this.isCachedAsTexture ? this.textureOffsetInverseTransform : this._parentCacheAsTextureRenderGroup ? this._parentCacheAsTextureRenderGroup.textureOffsetInverseTransform : null;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/assignWithIgnore.mjs
function Mn(e, t, n = {}) {
	for (let r in t) !n[r] && t[r] !== void 0 && (e[r] = t[r]);
}
var Nn = o((() => {})), Pn, Fn, In, Ln, Rn, zn = o((() => {
	b(), ye(), xe(), g(), R(), Te(), je(), Ne(), Le(), U(), Ke(), Je(), Qe(), et(), st(), lt(), bt(), Mt(), Bt(), Ht(), Gt(), qt(), jn(), Nn(), Pn = new Ae(null), Fn = new Ae(null), In = new Ae(null, 1, 1), Ln = new Ae(null), Rn = class e extends y {
		constructor(e = {}) {
			super(), this.uid = z("renderable"), this._updateFlags = 15, this.renderGroup = null, this.parentRenderGroup = null, this.parentRenderGroupIndex = 0, this.didChange = !1, this.didViewUpdate = !1, this.relativeRenderGroupDepth = 0, this.children = [], this.parent = null, this.includeInBuild = !0, this.measurable = !0, this.isSimple = !0, this.parentRenderLayer = null, this.updateTick = -1, this.localTransform = new L(), this.relativeGroupTransform = new L(), this.groupTransform = this.relativeGroupTransform, this.destroyed = !1, this._position = new Ae(this, 0, 0), this._scale = In, this._pivot = Fn, this._origin = Ln, this._skew = Pn, this._cx = 1, this._sx = 0, this._cy = 0, this._sy = 1, this._rotation = 0, this.localColor = 16777215, this.localAlpha = 1, this.groupAlpha = 1, this.groupColor = 16777215, this.groupColorAlpha = 4294967295, this.localBlendMode = "inherit", this.groupBlendMode = "normal", this.localDisplayStatus = 7, this.globalDisplayStatus = 7, this._didContainerChangeTick = 0, this._didViewChangeTick = 0, this._didLocalTransformChangeId = -1, this.effects = [], Mn(this, e, {
				children: !0,
				parent: !0,
				effects: !0
			}), e.children?.forEach((e) => this.addChild(e)), e.parent?.addChild(this);
		}
		static mixin(t) {
			V("8.8.0", "Container.mixin is deprecated, please use extensions.mixin instead."), h.mixin(e, t);
		}
		set _didChangeId(e) {
			this._didViewChangeTick = e >> 12 & 4095, this._didContainerChangeTick = e & 4095;
		}
		get _didChangeId() {
			return this._didContainerChangeTick & 4095 | (this._didViewChangeTick & 4095) << 12;
		}
		addChild(...e) {
			if (this.allowChildren || V(B, "addChild: Only Containers will be allowed to add children in v8.0.0"), e.length > 1) {
				for (let t = 0; t < e.length; t++) this.addChild(e[t]);
				return e[0];
			}
			let t = e[0], n = this.renderGroup || this.parentRenderGroup;
			return t.parent === this ? (this.children.splice(this.children.indexOf(t), 1), this.children.push(t), n && (n.structureDidChange = !0), t) : (t.parent && t.parent.removeChild(t), this.children.push(t), this.sortableChildren && (this.sortDirty = !0), t.parent = this, t.didChange = !0, t._updateFlags = 15, n && n.addChild(t), this.emit("childAdded", t, this, this.children.length - 1), t.emit("added", this), this._didViewChangeTick++, t._zIndex !== 0 && t.depthOfChildModified(), t);
		}
		removeChild(...e) {
			if (e.length > 1) {
				for (let t = 0; t < e.length; t++) this.removeChild(e[t]);
				return e[0];
			}
			let t = e[0], n = this.children.indexOf(t);
			return n > -1 && (this._didViewChangeTick++, this.children.splice(n, 1), this.renderGroup ? this.renderGroup.removeChild(t) : this.parentRenderGroup && this.parentRenderGroup.removeChild(t), t.parentRenderLayer && t.parentRenderLayer.detach(t), t.parent = null, this.emit("childRemoved", t, this, n), t.emit("removed", this)), t;
		}
		_onUpdate(e) {
			e && e === this._skew && this._updateSkew(), this._didContainerChangeTick++, !this.didChange && (this.didChange = !0, this.parentRenderGroup && this.parentRenderGroup.onChildUpdate(this));
		}
		set isRenderGroup(e) {
			!!this.renderGroup !== e && (e ? this.enableRenderGroup() : this.disableRenderGroup());
		}
		get isRenderGroup() {
			return !!this.renderGroup;
		}
		enableRenderGroup() {
			if (this.renderGroup) return;
			let e = this.parentRenderGroup;
			e?.removeChild(this), this.renderGroup = Ge.get(An, this), this.groupTransform = L.IDENTITY, e?.addChild(this), this._updateIsSimple();
		}
		disableRenderGroup() {
			if (!this.renderGroup) return;
			let e = this.parentRenderGroup;
			e?.removeChild(this), Ge.return(this.renderGroup), this.renderGroup = null, this.groupTransform = this.relativeGroupTransform, e?.addChild(this), this._updateIsSimple();
		}
		_updateIsSimple() {
			this.isSimple = !this.renderGroup && this.effects.length === 0;
		}
		get worldTransform() {
			return this._worldTransform || (this._worldTransform = new L()), this.renderGroup ? this._worldTransform.copyFrom(this.renderGroup.worldTransform) : this.parentRenderGroup && this._worldTransform.appendFrom(this.relativeGroupTransform, this.parentRenderGroup.worldTransform), this._worldTransform;
		}
		get x() {
			return this._position.x;
		}
		set x(e) {
			this._position.x = e;
		}
		get y() {
			return this._position.y;
		}
		set y(e) {
			this._position.y = e;
		}
		get position() {
			return this._position;
		}
		set position(e) {
			this._position.copyFrom(e);
		}
		get rotation() {
			return this._rotation;
		}
		set rotation(e) {
			this._rotation !== e && (this._rotation = e, this._onUpdate(this._skew));
		}
		get angle() {
			return this.rotation * Ce;
		}
		set angle(e) {
			this.rotation = e * we;
		}
		get pivot() {
			return this._pivot === Fn && (this._pivot = new Ae(this, 0, 0)), this._pivot;
		}
		set pivot(e) {
			this._pivot === Fn && (this._pivot = new Ae(this, 0, 0), this._origin !== Ln && H("Setting both a pivot and origin on a Container is not recommended. This can lead to unexpected behavior if not handled carefully.")), typeof e == "number" ? this._pivot.set(e) : this._pivot.copyFrom(e);
		}
		get skew() {
			return this._skew === Pn && (this._skew = new Ae(this, 0, 0)), this._skew;
		}
		set skew(e) {
			this._skew === Pn && (this._skew = new Ae(this, 0, 0)), this._skew.copyFrom(e);
		}
		get scale() {
			return this._scale === In && (this._scale = new Ae(this, 1, 1)), this._scale;
		}
		set scale(e) {
			this._scale === In && (this._scale = new Ae(this, 0, 0)), typeof e == "string" && (e = parseFloat(e)), typeof e == "number" ? this._scale.set(e) : this._scale.copyFrom(e);
		}
		get origin() {
			return this._origin === Ln && (this._origin = new Ae(this, 0, 0)), this._origin;
		}
		set origin(e) {
			this._origin === Ln && (this._origin = new Ae(this, 0, 0), this._pivot !== Fn && H("Setting both a pivot and origin on a Container is not recommended. This can lead to unexpected behavior if not handled carefully.")), typeof e == "number" ? this._origin.set(e) : this._origin.copyFrom(e);
		}
		get width() {
			return Math.abs(this.scale.x * this.getLocalBounds().width);
		}
		set width(e) {
			let t = this.getLocalBounds().width;
			this._setWidth(e, t);
		}
		get height() {
			return Math.abs(this.scale.y * this.getLocalBounds().height);
		}
		set height(e) {
			let t = this.getLocalBounds().height;
			this._setHeight(e, t);
		}
		getSize(e) {
			e || (e = {});
			let t = this.getLocalBounds();
			return e.width = Math.abs(this.scale.x * t.width), e.height = Math.abs(this.scale.y * t.height), e;
		}
		setSize(e, t) {
			let n = this.getLocalBounds();
			typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ?? (t = e), e !== void 0 && this._setWidth(e, n.width), t !== void 0 && this._setHeight(t, n.height);
		}
		_updateSkew() {
			let e = this._rotation, t = this._skew;
			this._cx = Math.cos(e + t._y), this._sx = Math.sin(e + t._y), this._cy = -Math.sin(e - t._x), this._sy = Math.cos(e - t._x);
		}
		updateTransform(e) {
			return this.position.set(typeof e.x == "number" ? e.x : this.position.x, typeof e.y == "number" ? e.y : this.position.y), this.scale.set(typeof e.scaleX == "number" ? e.scaleX || 1 : this.scale.x, typeof e.scaleY == "number" ? e.scaleY || 1 : this.scale.y), this.rotation = typeof e.rotation == "number" ? e.rotation : this.rotation, this.skew.set(typeof e.skewX == "number" ? e.skewX : this.skew.x, typeof e.skewY == "number" ? e.skewY : this.skew.y), this.pivot.set(typeof e.pivotX == "number" ? e.pivotX : this.pivot.x, typeof e.pivotY == "number" ? e.pivotY : this.pivot.y), this.origin.set(typeof e.originX == "number" ? e.originX : this.origin.x, typeof e.originY == "number" ? e.originY : this.origin.y), this;
		}
		setFromMatrix(e) {
			e.decompose(this);
		}
		updateLocalTransform() {
			let e = this._didContainerChangeTick;
			if (this._didLocalTransformChangeId === e) return;
			this._didLocalTransformChangeId = e;
			let t = this.localTransform, n = this._scale, r = this._pivot, i = this._origin, a = this._position, o = n._x, s = n._y, c = r._x, l = r._y, u = -i._x, d = -i._y;
			t.a = this._cx * o, t.b = this._sx * o, t.c = this._cy * s, t.d = this._sy * s, t.tx = a._x - (c * t.a + l * t.c) + (u * t.a + d * t.c) - u, t.ty = a._y - (c * t.b + l * t.d) + (u * t.b + d * t.d) - d;
		}
		set alpha(e) {
			e !== this.localAlpha && (this.localAlpha = e, this._updateFlags |= 1, this._onUpdate());
		}
		get alpha() {
			return this.localAlpha;
		}
		set tint(e) {
			let t = F.shared.setValue(e ?? 16777215).toBgrNumber();
			t !== this.localColor && (this.localColor = t, this._updateFlags |= 1, this._onUpdate());
		}
		get tint() {
			return At(this.localColor);
		}
		set blendMode(e) {
			this.localBlendMode !== e && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 2, this.localBlendMode = e, this._onUpdate());
		}
		get blendMode() {
			return this.localBlendMode;
		}
		get visible() {
			return !!(this.localDisplayStatus & 2);
		}
		set visible(e) {
			let t = e ? 2 : 0;
			(this.localDisplayStatus & 2) !== t && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 4, this.localDisplayStatus ^= 2, this._onUpdate(), this.emit("visibleChanged", e));
		}
		get culled() {
			return !(this.localDisplayStatus & 4);
		}
		set culled(e) {
			let t = e ? 0 : 4;
			(this.localDisplayStatus & 4) !== t && (this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._updateFlags |= 4, this.localDisplayStatus ^= 4, this._onUpdate());
		}
		get renderable() {
			return !!(this.localDisplayStatus & 1);
		}
		set renderable(e) {
			let t = e ? 1 : 0;
			(this.localDisplayStatus & 1) !== t && (this._updateFlags |= 4, this.localDisplayStatus ^= 1, this.parentRenderGroup && (this.parentRenderGroup.structureDidChange = !0), this._onUpdate());
		}
		get isRenderable() {
			return this.localDisplayStatus === 7 && this.groupAlpha > 0;
		}
		destroy(e = !1) {
			if (this.destroyed) return;
			this.destroyed = !0;
			let t;
			if (this.children.length && (t = this.removeChildren(0, this.children.length)), this.removeFromParent(), this.parent = null, this._maskEffect = null, this._filterEffect = null, this.effects = null, this._position = null, this._scale = null, this._pivot = null, this._origin = null, this._skew = null, this.emit("destroyed", this), this.removeAllListeners(), (typeof e == "boolean" ? e : e?.children) && t) for (let n = 0; n < t.length; ++n) t[n].destroy(e);
			this.renderGroup?.destroy(), this.renderGroup = null;
		}
	}, h.mixin(Rn, Ze, yt, Kt, Vt, zt, ot, ct, Wt, be, qe, jt, $e);
})), Bn, Vn = o((() => {
	Bn = /* @__PURE__ */ ((e) => (e[e.INTERACTION = 50] = "INTERACTION", e[e.HIGH = 25] = "HIGH", e[e.NORMAL = 0] = "NORMAL", e[e.LOW = -25] = "LOW", e[e.UTILITY = -50] = "UTILITY", e))(Bn || {});
})), Hn, Un = o((() => {
	Hn = class {
		constructor(e, t = null, n = 0, r = !1) {
			this.next = null, this.previous = null, this._destroyed = !1, this._fn = e, this._context = t, this.priority = n, this._once = r;
		}
		match(e, t = null) {
			return this._fn === e && this._context === t;
		}
		emit(e) {
			this._fn && (this._context ? this._fn.call(this._context, e) : this._fn(e));
			let t = this.next;
			return this._once && this.destroy(!0), this._destroyed && (this.next = null), t;
		}
		connect(e) {
			this.previous = e, e.next && (e.next.previous = this), this.next = e.next, e.next = this;
		}
		destroy(e = !1) {
			this._destroyed = !0, this._fn = null, this._context = null, this.previous && (this.previous.next = this.next), this.next && (this.next.previous = this.previous);
			let t = this.next;
			return this.next = e ? null : t, this.previous = null, t;
		}
	};
})), Wn, Gn, Kn = o((() => {
	Vn(), Un(), Wn = class e {
		constructor() {
			this.autoStart = !1, this.deltaTime = 1, this.lastTime = -1, this.speed = 1, this.started = !1, this._requestId = null, this._maxElapsedMS = 100, this._minElapsedMS = 0, this._protected = !1, this._lastFrame = -1, this._head = new Hn(null, null, Infinity), this.deltaMS = 1 / e.targetFPMS, this.elapsedMS = 1 / e.targetFPMS, this._tick = (e) => {
				this._requestId = null, this.started && (this.update(e), this.started && this._requestId === null && this._head.next && (this._requestId = requestAnimationFrame(this._tick)));
			};
		}
		_requestIfNeeded() {
			this._requestId === null && this._head.next && (this.lastTime = performance.now(), this._lastFrame = this.lastTime, this._requestId = requestAnimationFrame(this._tick));
		}
		_cancelIfNeeded() {
			this._requestId !== null && (cancelAnimationFrame(this._requestId), this._requestId = null);
		}
		_startIfPossible() {
			this.started ? this._requestIfNeeded() : this.autoStart && this.start();
		}
		add(e, t, n = Bn.NORMAL) {
			return this._addListener(new Hn(e, t, n));
		}
		addOnce(e, t, n = Bn.NORMAL) {
			return this._addListener(new Hn(e, t, n, !0));
		}
		_addListener(e) {
			let t = this._head.next, n = this._head;
			if (!t) e.connect(n);
			else {
				for (; t;) {
					if (e.priority > t.priority) {
						e.connect(n);
						break;
					}
					n = t, t = t.next;
				}
				e.previous || e.connect(n);
			}
			return this._startIfPossible(), this;
		}
		remove(e, t) {
			let n = this._head.next;
			for (; n;) n = n.match(e, t) ? n.destroy() : n.next;
			return this._head.next || this._cancelIfNeeded(), this;
		}
		get count() {
			if (!this._head) return 0;
			let e = 0, t = this._head;
			for (; t = t.next;) e++;
			return e;
		}
		start() {
			this.started || (this.started = !0, this._requestIfNeeded());
		}
		stop() {
			this.started && (this.started = !1, this._cancelIfNeeded());
		}
		destroy() {
			if (!this._protected) {
				this.stop();
				let e = this._head.next;
				for (; e;) e = e.destroy(!0);
				this._head.destroy(), this._head = null;
			}
		}
		update(t = performance.now()) {
			let n;
			if (t > this.lastTime) {
				if (n = this.elapsedMS = t - this.lastTime, n > this._maxElapsedMS && (n = this._maxElapsedMS), n *= this.speed, this._minElapsedMS) {
					let e = t - this._lastFrame | 0;
					if (e < this._minElapsedMS) return;
					this._lastFrame = t - e % this._minElapsedMS;
				}
				this.deltaMS = n, this.deltaTime = this.deltaMS * e.targetFPMS;
				let r = this._head, i = r.next;
				for (; i;) i = i.emit(this);
				r.next || this._cancelIfNeeded();
			} else this.deltaTime = this.deltaMS = this.elapsedMS = 0;
			this.lastTime = t;
		}
		get FPS() {
			return 1e3 / this.elapsedMS;
		}
		get minFPS() {
			return 1e3 / this._maxElapsedMS;
		}
		set minFPS(t) {
			this._maxElapsedMS = 1 / Math.min(Math.max(0, t) / 1e3, e.targetFPMS), this._minElapsedMS && t > this.maxFPS && (this.maxFPS = t);
		}
		get maxFPS() {
			return this._minElapsedMS ? Math.round(1e3 / this._minElapsedMS) : 0;
		}
		set maxFPS(e) {
			e === 0 ? this._minElapsedMS = 0 : (e < this.minFPS && (this.minFPS = e), this._minElapsedMS = 1 / (e / 1e3));
		}
		static get shared() {
			if (!e._shared) {
				let t = e._shared = new e();
				t.autoStart = !0, t._protected = !0;
			}
			return e._shared;
		}
		static get system() {
			if (!e._system) {
				let t = e._system = new e();
				t.autoStart = !0, t._protected = !0;
			}
			return e._system;
		}
	}, Wn.targetFPMS = .06, Gn = Wn;
})), qn, Jn = o((() => {
	Vn(), Kn(), qn = class {
		constructor(e) {
			this._lastTransform = "", this._observer = null, this._tickerAttached = !1, this.updateTranslation = () => {
				if (!this._canvas) return;
				let e = this._canvas.getBoundingClientRect(), t = this._canvas.width, n = this._canvas.height, r = e.width / t * this._renderer.resolution, i = e.height / n * this._renderer.resolution, a = `translate(${e.left}px, ${e.top}px) scale(${r}, ${i})`;
				a !== this._lastTransform && (this._domElement.style.transform = a, this._lastTransform = a);
			}, this._domElement = e.domElement, this._renderer = e.renderer, !(globalThis.OffscreenCanvas && this._renderer.canvas instanceof OffscreenCanvas) && (this._canvas = this._renderer.canvas, this._attachObserver());
		}
		get canvas() {
			return this._canvas;
		}
		ensureAttached() {
			!this._domElement.parentNode && this._canvas.parentNode && (this._canvas.parentNode.appendChild(this._domElement), this.updateTranslation());
		}
		_attachObserver() {
			"ResizeObserver" in globalThis ? (this._observer && (this._observer.disconnect(), this._observer = null), this._observer = new ResizeObserver((e) => {
				for (let t of e) {
					if (t.target !== this._canvas) continue;
					let e = this.canvas.width, n = this.canvas.height, r = t.contentRect.width / e * this._renderer.resolution, i = t.contentRect.height / n * this._renderer.resolution;
					(this._lastScaleX !== r || this._lastScaleY !== i) && (this.updateTranslation(), this._lastScaleX = r, this._lastScaleY = i);
				}
			}), this._observer.observe(this._canvas)) : this._tickerAttached || Gn.shared.add(this.updateTranslation, this, Bn.HIGH);
		}
		destroy() {
			this._observer ? (this._observer.disconnect(), this._observer = null) : this._tickerAttached && Gn.shared.remove(this.updateTranslation), this._domElement = null, this._renderer = null, this._canvas = null, this._tickerAttached = !1, this._lastTransform = "", this._lastScaleX = null, this._lastScaleY = null;
		}
	};
})), Yn, Xn = o((() => {
	De(), Yn = class e {
		constructor(t) {
			this.bubbles = !0, this.cancelBubble = !0, this.cancelable = !1, this.composed = !1, this.defaultPrevented = !1, this.eventPhase = e.prototype.NONE, this.propagationStopped = !1, this.propagationImmediatelyStopped = !1, this.layer = new I(), this.page = new I(), this.NONE = 0, this.CAPTURING_PHASE = 1, this.AT_TARGET = 2, this.BUBBLING_PHASE = 3, this.manager = t;
		}
		get layerX() {
			return this.layer.x;
		}
		get layerY() {
			return this.layer.y;
		}
		get pageX() {
			return this.page.x;
		}
		get pageY() {
			return this.page.y;
		}
		get data() {
			return this;
		}
		composedPath() {
			return this.manager && (!this.path || this.path[this.path.length - 1] !== this.target) && (this.path = this.target ? this.manager.propagationPath(this.target) : []), this.path;
		}
		initEvent(e, t, n) {
			throw Error("initEvent() is a legacy DOM API. It is not implemented in the Federated Events API.");
		}
		initUIEvent(e, t, n, r, i) {
			throw Error("initUIEvent() is a legacy DOM API. It is not implemented in the Federated Events API.");
		}
		preventDefault() {
			this.nativeEvent instanceof Event && this.nativeEvent.cancelable && this.nativeEvent.preventDefault(), this.defaultPrevented = !0;
		}
		stopImmediatePropagation() {
			this.propagationImmediatelyStopped = !0;
		}
		stopPropagation() {
			this.propagationStopped = !0;
		}
	};
}));
//#endregion
//#region node_modules/ismobilejs/esm/isMobile.js
function Zn(e) {
	return function(t) {
		return t.test(e);
	};
}
function Qn(e) {
	var t = {
		userAgent: "",
		platform: "",
		maxTouchPoints: 0
	};
	!e && typeof navigator < "u" ? t = {
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		maxTouchPoints: navigator.maxTouchPoints || 0
	} : typeof e == "string" ? t.userAgent = e : e && e.userAgent && (t = {
		userAgent: e.userAgent,
		platform: e.platform,
		maxTouchPoints: e.maxTouchPoints || 0
	});
	var n = t.userAgent, r = n.split("[FBAN");
	r[1] !== void 0 && (n = r[0]), r = n.split("Twitter"), r[1] !== void 0 && (n = r[0]);
	var i = Zn(n), a = {
		apple: {
			phone: i($n) && !i(sr),
			ipod: i(er),
			tablet: !i($n) && (i(tr) || mr(t)) && !i(sr),
			universal: i(nr),
			device: (i($n) || i(er) || i(tr) || i(nr) || mr(t)) && !i(sr)
		},
		amazon: {
			phone: i(ar),
			tablet: !i(ar) && i(or),
			device: i(ar) || i(or)
		},
		android: {
			phone: !i(sr) && i(ar) || !i(sr) && i(rr),
			tablet: !i(sr) && !i(ar) && !i(rr) && (i(or) || i(ir)),
			device: !i(sr) && (i(ar) || i(or) || i(rr) || i(ir)) || i(/\bokhttp\b/i)
		},
		windows: {
			phone: i(sr),
			tablet: i(cr),
			device: i(sr) || i(cr)
		},
		other: {
			blackberry: i(lr),
			blackberry10: i(ur),
			opera: i(dr),
			firefox: i(pr),
			chrome: i(fr),
			device: i(lr) || i(ur) || i(dr) || i(pr) || i(fr)
		},
		any: !1,
		phone: !1,
		tablet: !1
	};
	return a.any = a.apple.device || a.android.device || a.windows.device || a.other.device, a.phone = a.apple.phone || a.android.phone || a.windows.phone, a.tablet = a.apple.tablet || a.android.tablet || a.windows.tablet, a;
}
var $n, er, tr, nr, rr, ir, ar, or, sr, cr, lr, ur, dr, fr, pr, mr, hr = o((() => {
	$n = /iPhone/i, er = /iPod/i, tr = /iPad/i, nr = /\biOS-universal(?:.+)Mac\b/i, rr = /\bAndroid(?:.+)Mobile\b/i, ir = /Android/i, ar = /(?:SD4930UR|\bSilk(?:.+)Mobile\b)/i, or = /Silk/i, sr = /Windows Phone/i, cr = /\bWindows(?:.+)ARM\b/i, lr = /BlackBerry/i, ur = /BB10/i, dr = /Opera Mini/i, fr = /\b(CriOS|Chrome)(?:.+)Mobile/i, pr = /Mobile(?:.+)Firefox\b/i, mr = function(e) {
		return e !== void 0 && e.platform === "MacIntel" && typeof e.maxTouchPoints == "number" && e.maxTouchPoints > 1 && typeof MSStream > "u";
	};
})), gr = o((() => {
	hr(), hr();
})), _r, vr = o((() => {
	gr(), _r = (Qn.default ?? Qn)(globalThis.navigator);
})), yr, br, xr, Sr, Cr, wr, Tr, Er, Dr, Or, kr, Ar = o((() => {
	Jn(), Xn(), g(), vr(), Xe(), yr = 9, br = 100, xr = 0, Sr = 0, Cr = 2, wr = 1, Tr = -1e3, Er = -1e3, Dr = 2, Or = class e {
		constructor(e, t = _r) {
			this._mobileInfo = t, this.debug = !1, this._activateOnTab = !0, this._deactivateOnMouseMove = !0, this._isActive = !1, this._isMobileAccessibility = !1, this._div = null, this._pools = {}, this._renderId = 0, this._children = [], this._androidUpdateCount = 0, this._androidUpdateFrequency = 500, this._isRunningTests = !1, this._boundOnKeyDown = this._onKeyDown.bind(this), this._boundOnMouseMove = this._onMouseMove.bind(this), this._hookDiv = null, (t.tablet || t.phone) && this._createTouchHook(), this._renderer = e;
		}
		get isActive() {
			return this._isActive;
		}
		get isMobileAccessibility() {
			return this._isMobileAccessibility;
		}
		get hookDiv() {
			return this._hookDiv;
		}
		get div() {
			return this._div;
		}
		_createTouchHook() {
			let e = document.createElement("button");
			e.style.width = `${wr}px`, e.style.height = `${wr}px`, e.style.position = "absolute", e.style.top = `${Tr}px`, e.style.left = `${Er}px`, e.style.zIndex = Dr.toString(), e.style.backgroundColor = "#FF0000", e.title = "select to enable accessibility for this content", e.addEventListener("focus", () => {
				this._isMobileAccessibility = !0, this._activate(), this._destroyTouchHook();
			}), document.body.appendChild(e), this._hookDiv = e;
		}
		_destroyTouchHook() {
			this._hookDiv && (document.body.removeChild(this._hookDiv), this._hookDiv = null);
		}
		_activate() {
			if (this._isActive) return;
			this._isActive = !0, this._div || (this._div = document.createElement("div"), this._div.style.position = "absolute", this._div.style.top = `${xr}px`, this._div.style.left = `${Sr}px`, this._div.style.pointerEvents = "none", this._div.style.zIndex = Cr.toString(), this._canvasObserver = new qn({
				domElement: this._div,
				renderer: this._renderer
			})), this._activateOnTab && globalThis.addEventListener("keydown", this._boundOnKeyDown, !1), this._deactivateOnMouseMove && globalThis.document.addEventListener("mousemove", this._boundOnMouseMove, !0);
			let e = this._renderer.view.canvas;
			if (e.parentNode) this._canvasObserver.ensureAttached(), this._initAccessibilitySetup();
			else {
				let t = new MutationObserver(() => {
					e.parentNode && (t.disconnect(), this._canvasObserver.ensureAttached(), this._initAccessibilitySetup());
				});
				t.observe(document.body, {
					childList: !0,
					subtree: !0
				});
			}
		}
		_initAccessibilitySetup() {
			this._renderer.runners.postrender.add(this), this._renderer.lastObjectRendered && this._updateAccessibleObjects(this._renderer.lastObjectRendered);
		}
		_deactivate() {
			if (!(!this._isActive || this._isMobileAccessibility)) {
				this._isActive = !1, globalThis.document.removeEventListener("mousemove", this._boundOnMouseMove, !0), this._activateOnTab && globalThis.addEventListener("keydown", this._boundOnKeyDown, !1), this._renderer.runners.postrender.remove(this);
				for (let e of this._children) e._accessibleDiv?.parentNode && (e._accessibleDiv.parentNode.removeChild(e._accessibleDiv), e._accessibleDiv = null), e._accessibleActive = !1;
				for (let e in this._pools) this._pools[e].forEach((e) => {
					e.parentNode && e.parentNode.removeChild(e);
				}), delete this._pools[e];
				this._div?.parentNode && this._div.parentNode.removeChild(this._div), this._pools = {}, this._children = [];
			}
		}
		_updateAccessibleObjects(e) {
			if (!e.visible || !e.accessibleChildren) return;
			e.accessible && (e._accessibleActive || this._addChild(e), e._renderId = this._renderId);
			let t = e.children;
			if (t) for (let e = 0; e < t.length; e++) this._updateAccessibleObjects(t[e]);
		}
		init(t) {
			let n = { accessibilityOptions: {
				...e.defaultOptions,
				...t?.accessibilityOptions || {}
			} };
			this.debug = n.accessibilityOptions.debug, this._activateOnTab = n.accessibilityOptions.activateOnTab, this._deactivateOnMouseMove = n.accessibilityOptions.deactivateOnMouseMove, n.accessibilityOptions.enabledByDefault && this._activate(), this._renderer.runners.postrender.remove(this);
		}
		postrender() {
			let e = performance.now();
			if (this._mobileInfo.android.device && e < this._androidUpdateCount || (this._androidUpdateCount = e + this._androidUpdateFrequency, (!this._renderer.renderingToScreen || !this._renderer.view.canvas) && !this._isRunningTests)) return;
			let t = /* @__PURE__ */ new Set();
			if (this._renderer.lastObjectRendered) {
				this._updateAccessibleObjects(this._renderer.lastObjectRendered);
				for (let e of this._children) e._renderId === this._renderId && t.add(this._children.indexOf(e));
			}
			for (let e = this._children.length - 1; e >= 0; e--) {
				let n = this._children[e];
				t.has(e) || (n._accessibleDiv && n._accessibleDiv.parentNode && (n._accessibleDiv.parentNode.removeChild(n._accessibleDiv), this._getPool(n.accessibleType).push(n._accessibleDiv), n._accessibleDiv = null), n._accessibleActive = !1, Ye(this._children, e, 1));
			}
			this._renderer.renderingToScreen && this._canvasObserver.ensureAttached();
			for (let e = 0; e < this._children.length; e++) {
				let t = this._children[e];
				if (!t._accessibleActive || !t._accessibleDiv) continue;
				let n = t._accessibleDiv, r = t.hitArea || t.getBounds().rectangle;
				if (t.hitArea) {
					let e = t.worldTransform;
					n.style.left = `${e.tx + r.x * e.a}px`, n.style.top = `${e.ty + r.y * e.d}px`, n.style.width = `${r.width * e.a}px`, n.style.height = `${r.height * e.d}px`;
				} else this._capHitArea(r), n.style.left = `${r.x}px`, n.style.top = `${r.y}px`, n.style.width = `${r.width}px`, n.style.height = `${r.height}px`;
			}
			this._renderId++;
		}
		_updateDebugHTML(e) {
			e.innerHTML = `type: ${e.type}</br> title : ${e.title}</br> tabIndex: ${e.tabIndex}`;
		}
		_capHitArea(e) {
			e.x < 0 && (e.width += e.x, e.x = 0), e.y < 0 && (e.height += e.y, e.y = 0);
			let { width: t, height: n } = this._renderer;
			e.x + e.width > t && (e.width = t - e.x), e.y + e.height > n && (e.height = n - e.y);
		}
		_addChild(e) {
			let t = this._getPool(e.accessibleType).pop();
			t ? (t.innerHTML = "", t.removeAttribute("title"), t.removeAttribute("aria-label"), t.tabIndex = 0) : (e.accessibleType === "button" ? t = document.createElement("button") : (t = document.createElement(e.accessibleType), t.style.cssText = "\n                        color: transparent;\n                        pointer-events: none;\n                        padding: 0;\n                        margin: 0;\n                        border: 0;\n                        outline: 0;\n                        background: transparent;\n                        box-sizing: border-box;\n                        user-select: none;\n                        -webkit-user-select: none;\n                        -moz-user-select: none;\n                        -ms-user-select: none;\n                    ", e.accessibleText && (t.innerText = e.accessibleText)), t.style.width = `${br}px`, t.style.height = `${br}px`, t.style.backgroundColor = this.debug ? "rgba(255,255,255,0.5)" : "transparent", t.style.position = "absolute", t.style.zIndex = Cr.toString(), t.style.borderStyle = "none", navigator.userAgent.toLowerCase().includes("chrome") ? t.setAttribute("aria-live", "off") : t.setAttribute("aria-live", "polite"), navigator.userAgent.match(/rv:.*Gecko\//) ? t.setAttribute("aria-relevant", "additions") : t.setAttribute("aria-relevant", "text"), t.addEventListener("click", this._onClick.bind(this)), t.addEventListener("focus", this._onFocus.bind(this)), t.addEventListener("focusout", this._onFocusOut.bind(this))), t.style.pointerEvents = e.accessiblePointerEvents, t.type = e.accessibleType, e.accessibleTitle && e.accessibleTitle !== null ? t.title = e.accessibleTitle : (!e.accessibleHint || e.accessibleHint === null) && (t.title = `container ${e.tabIndex}`), e.accessibleHint && e.accessibleHint !== null && t.setAttribute("aria-label", e.accessibleHint), e.interactive ? t.tabIndex = e.tabIndex : t.tabIndex = 0, this.debug && this._updateDebugHTML(t), e._accessibleActive = !0, e._accessibleDiv = t, t.container = e, this._children.push(e), this._div.appendChild(e._accessibleDiv);
		}
		_dispatchEvent(e, t) {
			let { container: n } = e.target, r = this._renderer.events.rootBoundary, i = Object.assign(new Yn(r), { target: n });
			r.rootTarget = this._renderer.lastObjectRendered, t.forEach((e) => r.dispatchEvent(i, e));
		}
		_onClick(e) {
			this._dispatchEvent(e, [
				"click",
				"pointertap",
				"tap"
			]);
		}
		_onFocus(e) {
			e.target.getAttribute("aria-live") || e.target.setAttribute("aria-live", "assertive"), this._dispatchEvent(e, ["mouseover"]);
		}
		_onFocusOut(e) {
			e.target.getAttribute("aria-live") || e.target.setAttribute("aria-live", "polite"), this._dispatchEvent(e, ["mouseout"]);
		}
		_onKeyDown(e) {
			e.keyCode !== yr || !this._activateOnTab || this._activate();
		}
		_onMouseMove(e) {
			e.movementX === 0 && e.movementY === 0 || this._deactivate();
		}
		destroy() {
			this._deactivate(), this._destroyTouchHook(), this._canvasObserver?.destroy(), this._canvasObserver = null, this._div = null, this._pools = null, this._children = null, this._renderer = null, this._hookDiv = null, globalThis.removeEventListener("keydown", this._boundOnKeyDown), this._boundOnKeyDown = null, globalThis.document.removeEventListener("mousemove", this._boundOnMouseMove, !0), this._boundOnMouseMove = null;
		}
		setAccessibilityEnabled(e) {
			e ? this._activate() : this._deactivate();
		}
		_getPool(e) {
			return this._pools[e] || (this._pools[e] = []), this._pools[e];
		}
	}, Or.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "accessibility"
	}, Or.defaultOptions = {
		enabledByDefault: !1,
		debug: !1,
		activateOnTab: !0,
		deactivateOnMouseMove: !0
	}, kr = Or;
})), jr, Mr = o((() => {
	jr = {
		accessible: !1,
		accessibleTitle: null,
		accessibleHint: null,
		tabIndex: 0,
		accessibleType: "button",
		accessibleText: null,
		accessiblePointerEvents: "auto",
		accessibleChildren: !0,
		_accessibleActive: !1,
		_accessibleDiv: null,
		_renderId: -1
	};
})), Nr = o((() => {
	g(), zn(), Ar(), Mr(), h.add(kr), h.mixin(Rn, jr);
})), Pr, Fr = o((() => {
	g(), Jn(), Pr = class {
		constructor(e) {
			this._attachedDomElements = [], this._renderer = e, this._renderer.runners.postrender.add(this), this._renderer.runners.init.add(this), this._domElement = document.createElement("div"), this._domElement.style.position = "absolute", this._domElement.style.top = "0", this._domElement.style.left = "0", this._domElement.style.pointerEvents = "none", this._domElement.style.zIndex = "1000";
		}
		init() {
			this._canvasObserver = new qn({
				domElement: this._domElement,
				renderer: this._renderer
			});
		}
		addRenderable(e, t) {
			this._attachedDomElements.includes(e) || this._attachedDomElements.push(e);
		}
		updateRenderable(e) {}
		validateRenderable(e) {
			return !0;
		}
		postrender() {
			let e = this._attachedDomElements;
			if (e.length === 0) {
				this._domElement.remove();
				return;
			}
			this._canvasObserver.ensureAttached();
			for (let t = 0; t < e.length; t++) {
				let n = e[t], r = n.element;
				if (!n.parent || n.globalDisplayStatus < 7) r?.remove(), e.splice(t, 1), t--;
				else {
					this._domElement.contains(r) || (r.style.position = "absolute", r.style.pointerEvents = "auto", this._domElement.appendChild(r));
					let e = n.worldTransform, t = n._anchor, i = n.width * t.x, a = n.height * t.y;
					r.style.transformOrigin = `${i}px ${a}px`, r.style.transform = `matrix(${e.a}, ${e.b}, ${e.c}, ${e.d}, ${e.tx - i}, ${e.ty - a})`, r.style.opacity = n.groupAlpha.toString();
				}
			}
		}
		destroy() {
			this._renderer.runners.postrender.remove(this);
			for (let e = 0; e < this._attachedDomElements.length; e++) this._attachedDomElements[e].element?.remove();
			this._attachedDomElements.length = 0, this._domElement.remove(), this._canvasObserver.destroy(), this._renderer = null;
		}
	}, Pr.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "dom"
	};
})), Ir, Lr = o((() => {
	mt(), zn(), Ir = class extends Rn {
		constructor(e) {
			super(e), this.canBundle = !0, this.allowChildren = !1, this._roundPixels = 0, this._lastUsed = -1, this._gpuData = /* @__PURE__ */ Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this._bounds = new pt(0, 1, 0, 0), this._boundsDirty = !0, this.autoGarbageCollect = e.autoGarbageCollect ?? !0;
		}
		get bounds() {
			return this._boundsDirty ? (this.updateBounds(), this._boundsDirty = !1, this._bounds) : this._bounds;
		}
		get roundPixels() {
			return !!this._roundPixels;
		}
		set roundPixels(e) {
			this._roundPixels = e ? 1 : 0;
		}
		containsPoint(e) {
			let t = this.bounds, { x: n, y: r } = e;
			return n >= t.minX && n <= t.maxX && r >= t.minY && r <= t.maxY;
		}
		onViewUpdate() {
			if (this._didViewChangeTick++, this._boundsDirty = !0, this.didViewUpdate) return;
			this.didViewUpdate = !0;
			let e = this.renderGroup || this.parentRenderGroup;
			e && e.onChildViewUpdate(this);
		}
		unload() {
			this.emit("unload", this);
			for (let e in this._gpuData) this._gpuData[e]?.destroy();
			this._gpuData = /* @__PURE__ */ Object.create(null), this.onViewUpdate();
		}
		destroy(e) {
			this.unload(), super.destroy(e), this._bounds = null;
		}
		collectRenderablesSimple(e, t, n) {
			let { renderPipes: r } = t;
			r.blendMode.pushBlendMode(this, this.groupBlendMode, e);
			let i = r[this.renderPipeId];
			i?.addRenderable && i.addRenderable(this, e), this.didViewUpdate = !1;
			let a = this.children, o = a.length;
			for (let r = 0; r < o; r++) a[r].collectRenderables(e, t, n);
			r.blendMode.popBlendMode(e);
		}
	};
})), Rr = o((() => {
	g(), Fr(), h.add(Pr);
})), zr, Br, Vr = o((() => {
	Vn(), Kn(), zr = class {
		constructor() {
			this.interactionFrequency = 10, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
		}
		init(e) {
			this.removeTickerListener(), this.events = e, this.interactionFrequency = 10, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
		}
		get pauseUpdate() {
			return this._pauseUpdate;
		}
		set pauseUpdate(e) {
			this._pauseUpdate = e;
		}
		addTickerListener() {
			this._tickerAdded || !this.domElement || (Gn.system.add(this._tickerUpdate, this, Bn.INTERACTION), this._tickerAdded = !0);
		}
		removeTickerListener() {
			this._tickerAdded && (Gn.system.remove(this._tickerUpdate, this), this._tickerAdded = !1);
		}
		pointerMoved() {
			this._didMove = !0;
		}
		_update() {
			if (!this.domElement || this._pauseUpdate) return;
			if (this._didMove) {
				this._didMove = !1;
				return;
			}
			let e = this.events._rootPointerEvent;
			this.events.supportsTouchEvents && e.pointerType === "touch" || globalThis.document.dispatchEvent(this.events.supportsPointerEvents ? new PointerEvent("pointermove", {
				clientX: e.clientX,
				clientY: e.clientY,
				pointerType: e.pointerType,
				pointerId: e.pointerId
			}) : new MouseEvent("mousemove", {
				clientX: e.clientX,
				clientY: e.clientY
			}));
		}
		_tickerUpdate(e) {
			this._deltaTime += e.deltaTime, !(this._deltaTime < this.interactionFrequency) && (this._deltaTime = 0, this._update());
		}
		destroy() {
			this.removeTickerListener(), this.events = null, this.domElement = null, this._deltaTime = 0, this._didMove = !1, this._tickerAdded = !1, this._pauseUpdate = !0;
		}
	}, Br = new zr();
})), Hr, Ur = o((() => {
	De(), Xn(), Hr = class extends Yn {
		constructor() {
			super(...arguments), this.client = new I(), this.movement = new I(), this.offset = new I(), this.global = new I(), this.screen = new I();
		}
		get clientX() {
			return this.client.x;
		}
		get clientY() {
			return this.client.y;
		}
		get x() {
			return this.clientX;
		}
		get y() {
			return this.clientY;
		}
		get movementX() {
			return this.movement.x;
		}
		get movementY() {
			return this.movement.y;
		}
		get offsetX() {
			return this.offset.x;
		}
		get offsetY() {
			return this.offset.y;
		}
		get globalX() {
			return this.global.x;
		}
		get globalY() {
			return this.global.y;
		}
		get screenX() {
			return this.screen.x;
		}
		get screenY() {
			return this.screen.y;
		}
		getLocalPosition(e, t, n) {
			return e.worldTransform.applyInverse(n || this.global, t);
		}
		getModifierState(e) {
			return "getModifierState" in this.nativeEvent && this.nativeEvent.getModifierState(e);
		}
		initMouseEvent(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m) {
			throw Error("Method not implemented.");
		}
	};
})), Wr, Gr = o((() => {
	Ur(), Wr = class extends Hr {
		constructor() {
			super(...arguments), this.width = 0, this.height = 0, this.isPrimary = !1;
		}
		getCoalescedEvents() {
			return this.type === "pointermove" || this.type === "mousemove" || this.type === "touchmove" ? [this] : [];
		}
		getPredictedEvents() {
			throw Error("getPredictedEvents is not supported!");
		}
	};
})), Kr, qr = o((() => {
	Ur(), Kr = class extends Hr {
		constructor() {
			super(...arguments), this.DOM_DELTA_PIXEL = 0, this.DOM_DELTA_LINE = 1, this.DOM_DELTA_PAGE = 2;
		}
	}, Kr.DOM_DELTA_PIXEL = 0, Kr.DOM_DELTA_LINE = 1, Kr.DOM_DELTA_PAGE = 2;
})), Jr, Yr, Xr, Zr, Qr = o((() => {
	b(), De(), U(), Vr(), Ur(), Gr(), qr(), Jr = 2048, Yr = new I(), Xr = new I(), Zr = class {
		constructor(e) {
			this.dispatch = new y(), this.moveOnAll = !1, this.enableGlobalMoveEvents = !0, this.mappingState = { trackingData: {} }, this.eventPool = /* @__PURE__ */ new Map(), this._allInteractiveElements = [], this._hitElements = [], this._isPointerMoveEvent = !1, this.rootTarget = e, this.hitPruneFn = this.hitPruneFn.bind(this), this.hitTestFn = this.hitTestFn.bind(this), this.mapPointerDown = this.mapPointerDown.bind(this), this.mapPointerMove = this.mapPointerMove.bind(this), this.mapPointerOut = this.mapPointerOut.bind(this), this.mapPointerOver = this.mapPointerOver.bind(this), this.mapPointerUp = this.mapPointerUp.bind(this), this.mapPointerUpOutside = this.mapPointerUpOutside.bind(this), this.mapWheel = this.mapWheel.bind(this), this.mappingTable = {}, this.addEventMapping("pointerdown", this.mapPointerDown), this.addEventMapping("pointermove", this.mapPointerMove), this.addEventMapping("pointerout", this.mapPointerOut), this.addEventMapping("pointerleave", this.mapPointerOut), this.addEventMapping("pointerover", this.mapPointerOver), this.addEventMapping("pointerup", this.mapPointerUp), this.addEventMapping("pointerupoutside", this.mapPointerUpOutside), this.addEventMapping("wheel", this.mapWheel);
		}
		addEventMapping(e, t) {
			this.mappingTable[e] || (this.mappingTable[e] = []), this.mappingTable[e].push({
				fn: t,
				priority: 0
			}), this.mappingTable[e].sort((e, t) => e.priority - t.priority);
		}
		dispatchEvent(e, t) {
			e.propagationStopped = !1, e.propagationImmediatelyStopped = !1, this.propagate(e, t), this.dispatch.emit(t || e.type, e);
		}
		mapEvent(e) {
			if (!this.rootTarget) return;
			let t = this.mappingTable[e.type];
			if (t) for (let n = 0, r = t.length; n < r; n++) t[n].fn(e);
			else H(`[EventBoundary]: Event mapping not defined for ${e.type}`);
		}
		hitTest(e, t) {
			Br.pauseUpdate = !0;
			let n = this._isPointerMoveEvent && this.enableGlobalMoveEvents ? "hitTestMoveRecursive" : "hitTestRecursive", r = this[n](this.rootTarget, this.rootTarget.eventMode, Yr.set(e, t), this.hitTestFn, this.hitPruneFn);
			return r && r[0];
		}
		propagate(e, t) {
			if (!e.target) return;
			let n = e.composedPath();
			e.eventPhase = e.CAPTURING_PHASE;
			for (let r = 0, i = n.length - 1; r < i; r++) if (e.currentTarget = n[r], this.notifyTarget(e, t), e.propagationStopped || e.propagationImmediatelyStopped) return;
			if (e.eventPhase = e.AT_TARGET, e.currentTarget = e.target, this.notifyTarget(e, t), !(e.propagationStopped || e.propagationImmediatelyStopped)) {
				e.eventPhase = e.BUBBLING_PHASE;
				for (let r = n.length - 2; r >= 0; r--) if (e.currentTarget = n[r], this.notifyTarget(e, t), e.propagationStopped || e.propagationImmediatelyStopped) return;
			}
		}
		all(e, t, n = this._allInteractiveElements) {
			if (n.length === 0) return;
			e.eventPhase = e.BUBBLING_PHASE;
			let r = Array.isArray(t) ? t : [t];
			for (let t = n.length - 1; t >= 0; t--) r.forEach((r) => {
				e.currentTarget = n[t], this.notifyTarget(e, r);
			});
		}
		propagationPath(e) {
			let t = [e];
			for (let n = 0; n < Jr && e !== this.rootTarget && e.parent; n++) {
				if (!e.parent) throw Error("Cannot find propagation path to disconnected target");
				t.push(e.parent), e = e.parent;
			}
			return t.reverse(), t;
		}
		hitTestMoveRecursive(e, t, n, r, i, a = !1) {
			let o = !1;
			if (this._interactivePrune(e)) return null;
			if ((e.eventMode === "dynamic" || t === "dynamic") && (Br.pauseUpdate = !1), e.interactiveChildren && e.children) {
				let s = e.children;
				for (let c = s.length - 1; c >= 0; c--) {
					let l = s[c], u = this.hitTestMoveRecursive(l, this._isInteractive(t) ? t : l.eventMode, n, r, i, a || i(e, n));
					if (u) {
						if (u.length > 0 && !u[u.length - 1].parent) continue;
						let t = e.isInteractive();
						(u.length > 0 || t) && (t && this._allInteractiveElements.push(e), u.push(e)), this._hitElements.length === 0 && (this._hitElements = u), o = !0;
					}
				}
			}
			let s = this._isInteractive(t), c = e.isInteractive();
			return c && c && this._allInteractiveElements.push(e), a || this._hitElements.length > 0 ? null : o ? this._hitElements : s && !i(e, n) && r(e, n) ? c ? [e] : [] : null;
		}
		hitTestRecursive(e, t, n, r, i) {
			if (this._interactivePrune(e) || i(e, n)) return null;
			if ((e.eventMode === "dynamic" || t === "dynamic") && (Br.pauseUpdate = !1), e.interactiveChildren && e.children) {
				let a = e.children, o = n;
				for (let n = a.length - 1; n >= 0; n--) {
					let s = a[n], c = this.hitTestRecursive(s, this._isInteractive(t) ? t : s.eventMode, o, r, i);
					if (c) {
						if (c.length > 0 && !c[c.length - 1].parent) continue;
						let t = e.isInteractive();
						return (c.length > 0 || t) && c.push(e), c;
					}
				}
			}
			let a = this._isInteractive(t), o = e.isInteractive();
			return a && r(e, n) ? o ? [e] : [] : null;
		}
		_isInteractive(e) {
			return e === "static" || e === "dynamic";
		}
		_interactivePrune(e) {
			return !e || !e.visible || !e.renderable || !e.measurable || e.eventMode === "none" || e.eventMode === "passive" && !e.interactiveChildren;
		}
		hitPruneFn(e, t) {
			if (e.hitArea && (e.worldTransform.applyInverse(t, Xr), !e.hitArea.contains(Xr.x, Xr.y))) return !0;
			if (e.effects && e.effects.length) for (let n = 0; n < e.effects.length; n++) {
				let r = e.effects[n];
				if (r.containsPoint && !r.containsPoint(t, this.hitTestFn)) return !0;
			}
			return !1;
		}
		hitTestFn(e, t) {
			return e.hitArea ? !0 : e?.containsPoint ? (e.worldTransform.applyInverse(t, Xr), e.containsPoint(Xr)) : !1;
		}
		notifyTarget(e, t) {
			if (!e.currentTarget.isInteractive()) return;
			t ?? (t = e.type);
			let n = `on${t}`;
			e.currentTarget[n]?.(e);
			let r = e.eventPhase === e.CAPTURING_PHASE || e.eventPhase === e.AT_TARGET ? `${t}capture` : t;
			this._notifyListeners(e, r), e.eventPhase === e.AT_TARGET && this._notifyListeners(e, t);
		}
		mapPointerDown(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			let t = this.createPointerEvent(e);
			if (this.dispatchEvent(t, "pointerdown"), t.pointerType === "touch") this.dispatchEvent(t, "touchstart");
			else if (t.pointerType === "mouse" || t.pointerType === "pen") {
				let e = t.button === 2;
				this.dispatchEvent(t, e ? "rightdown" : "mousedown");
			}
			let n = this.trackingData(e.pointerId);
			n.pressTargetsByButton[e.button] = t.composedPath(), this.freeEvent(t);
		}
		mapPointerMove(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			this._allInteractiveElements.length = 0, this._hitElements.length = 0, this._isPointerMoveEvent = !0;
			let t = this.createPointerEvent(e);
			this._isPointerMoveEvent = !1;
			let n = t.pointerType === "mouse" || t.pointerType === "pen", r = this.trackingData(e.pointerId), i = this.findMountedTarget(r.overTargets);
			if (r.overTargets?.length > 0 && i !== t.target) {
				let r = e.type === "mousemove" ? "mouseout" : "pointerout", a = this.createPointerEvent(e, r, i);
				if (this.dispatchEvent(a, "pointerout"), n && this.dispatchEvent(a, "mouseout"), !t.composedPath().includes(i)) {
					let r = this.createPointerEvent(e, "pointerleave", i);
					for (r.eventPhase = r.AT_TARGET; r.target && !t.composedPath().includes(r.target);) r.currentTarget = r.target, this.notifyTarget(r), n && this.notifyTarget(r, "mouseleave"), r.target = r.target.parent;
					this.freeEvent(r);
				}
				this.freeEvent(a);
			}
			if (i !== t.target) {
				let r = e.type === "mousemove" ? "mouseover" : "pointerover", a = this.clonePointerEvent(t, r);
				this.dispatchEvent(a, "pointerover"), n && this.dispatchEvent(a, "mouseover");
				let o = i?.parent;
				for (; o && o !== this.rootTarget.parent && o !== t.target;) o = o.parent;
				if (!o || o === this.rootTarget.parent) {
					let e = this.clonePointerEvent(t, "pointerenter");
					for (e.eventPhase = e.AT_TARGET; e.target && e.target !== i && e.target !== this.rootTarget.parent;) e.currentTarget = e.target, this.notifyTarget(e), n && this.notifyTarget(e, "mouseenter"), e.target = e.target.parent;
					this.freeEvent(e);
				}
				this.freeEvent(a);
			}
			let a = [], o = this.enableGlobalMoveEvents ?? !0;
			this.moveOnAll ? a.push("pointermove") : this.dispatchEvent(t, "pointermove"), o && a.push("globalpointermove"), t.pointerType === "touch" && (this.moveOnAll ? a.splice(1, 0, "touchmove") : this.dispatchEvent(t, "touchmove"), o && a.push("globaltouchmove")), n && (this.moveOnAll ? a.splice(1, 0, "mousemove") : this.dispatchEvent(t, "mousemove"), o && a.push("globalmousemove"), this.cursor = t.target?.cursor), a.length > 0 && this.all(t, a), this._allInteractiveElements.length = 0, this._hitElements.length = 0, r.overTargets = t.composedPath(), this.freeEvent(t);
		}
		mapPointerOver(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			let t = this.trackingData(e.pointerId), n = this.createPointerEvent(e), r = n.pointerType === "mouse" || n.pointerType === "pen";
			this.dispatchEvent(n, "pointerover"), r && this.dispatchEvent(n, "mouseover"), n.pointerType === "mouse" && (this.cursor = n.target?.cursor);
			let i = this.clonePointerEvent(n, "pointerenter");
			for (i.eventPhase = i.AT_TARGET; i.target && i.target !== this.rootTarget.parent;) i.currentTarget = i.target, this.notifyTarget(i), r && this.notifyTarget(i, "mouseenter"), i.target = i.target.parent;
			t.overTargets = n.composedPath(), this.freeEvent(n), this.freeEvent(i);
		}
		mapPointerOut(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			let t = this.trackingData(e.pointerId);
			if (t.overTargets) {
				let n = e.pointerType === "mouse" || e.pointerType === "pen", r = this.findMountedTarget(t.overTargets), i = this.createPointerEvent(e, "pointerout", r);
				this.dispatchEvent(i), n && this.dispatchEvent(i, "mouseout");
				let a = this.createPointerEvent(e, "pointerleave", r);
				for (a.eventPhase = a.AT_TARGET; a.target && a.target !== this.rootTarget.parent;) a.currentTarget = a.target, this.notifyTarget(a), n && this.notifyTarget(a, "mouseleave"), a.target = a.target.parent;
				t.overTargets = null, this.freeEvent(i), this.freeEvent(a);
			}
			this.cursor = null;
		}
		mapPointerUp(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			let t = performance.now(), n = this.createPointerEvent(e);
			if (this.dispatchEvent(n, "pointerup"), n.pointerType === "touch") this.dispatchEvent(n, "touchend");
			else if (n.pointerType === "mouse" || n.pointerType === "pen") {
				let e = n.button === 2;
				this.dispatchEvent(n, e ? "rightup" : "mouseup");
			}
			let r = this.trackingData(e.pointerId), i = this.findMountedTarget(r.pressTargetsByButton[e.button]), a = i;
			if (i && !n.composedPath().includes(i)) {
				let t = i;
				for (; t && !n.composedPath().includes(t);) {
					if (n.currentTarget = t, this.notifyTarget(n, "pointerupoutside"), n.pointerType === "touch") this.notifyTarget(n, "touchendoutside");
					else if (n.pointerType === "mouse" || n.pointerType === "pen") {
						let e = n.button === 2;
						this.notifyTarget(n, e ? "rightupoutside" : "mouseupoutside");
					}
					t = t.parent;
				}
				delete r.pressTargetsByButton[e.button], a = t;
			}
			if (a) {
				let i = this.clonePointerEvent(n, "click");
				i.target = a, i.path = null, r.clicksByButton[e.button] || (r.clicksByButton[e.button] = {
					clickCount: 0,
					target: i.target,
					timeStamp: t
				});
				let o = r.clicksByButton[e.button];
				if (o.target === i.target && t - o.timeStamp < 200 ? ++o.clickCount : o.clickCount = 1, o.target = i.target, o.timeStamp = t, i.detail = o.clickCount, i.pointerType === "mouse") {
					let e = i.button === 2;
					this.dispatchEvent(i, e ? "rightclick" : "click");
				} else i.pointerType === "touch" && this.dispatchEvent(i, "tap");
				this.dispatchEvent(i, "pointertap"), this.freeEvent(i);
			}
			this.freeEvent(n);
		}
		mapPointerUpOutside(e) {
			if (!(e instanceof Wr)) {
				H("EventBoundary cannot map a non-pointer event as a pointer event");
				return;
			}
			let t = this.trackingData(e.pointerId), n = this.findMountedTarget(t.pressTargetsByButton[e.button]), r = this.createPointerEvent(e);
			if (n) {
				let i = n;
				for (; i;) r.currentTarget = i, this.notifyTarget(r, "pointerupoutside"), r.pointerType === "touch" ? this.notifyTarget(r, "touchendoutside") : (r.pointerType === "mouse" || r.pointerType === "pen") && this.notifyTarget(r, r.button === 2 ? "rightupoutside" : "mouseupoutside"), i = i.parent;
				delete t.pressTargetsByButton[e.button];
			}
			this.freeEvent(r);
		}
		mapWheel(e) {
			if (!(e instanceof Kr)) {
				H("EventBoundary cannot map a non-wheel event as a wheel event");
				return;
			}
			let t = this.createWheelEvent(e);
			this.dispatchEvent(t), this.freeEvent(t);
		}
		findMountedTarget(e) {
			if (!e) return null;
			let t = e[0];
			for (let n = 1; n < e.length && e[n].parent === t; n++) t = e[n];
			return t;
		}
		createPointerEvent(e, t, n) {
			let r = this.allocateEvent(Wr);
			return this.copyPointerData(e, r), this.copyMouseData(e, r), this.copyData(e, r), r.nativeEvent = e.nativeEvent, r.originalEvent = e, r.target = n ?? this.hitTest(r.global.x, r.global.y) ?? this._hitElements[0], typeof t == "string" && (r.type = t), r;
		}
		createWheelEvent(e) {
			let t = this.allocateEvent(Kr);
			return this.copyWheelData(e, t), this.copyMouseData(e, t), this.copyData(e, t), t.nativeEvent = e.nativeEvent, t.originalEvent = e, t.target = this.hitTest(t.global.x, t.global.y), t;
		}
		clonePointerEvent(e, t) {
			let n = this.allocateEvent(Wr);
			return n.nativeEvent = e.nativeEvent, n.originalEvent = e.originalEvent, this.copyPointerData(e, n), this.copyMouseData(e, n), this.copyData(e, n), n.target = e.target, n.path = e.composedPath().slice(), n.type = t ?? n.type, n;
		}
		copyWheelData(e, t) {
			t.deltaMode = e.deltaMode, t.deltaX = e.deltaX, t.deltaY = e.deltaY, t.deltaZ = e.deltaZ;
		}
		copyPointerData(e, t) {
			e instanceof Wr && t instanceof Wr && (t.pointerId = e.pointerId, t.width = e.width, t.height = e.height, t.isPrimary = e.isPrimary, t.pointerType = e.pointerType, t.pressure = e.pressure, t.tangentialPressure = e.tangentialPressure, t.tiltX = e.tiltX, t.tiltY = e.tiltY, t.twist = e.twist);
		}
		copyMouseData(e, t) {
			e instanceof Hr && t instanceof Hr && (t.altKey = e.altKey, t.button = e.button, t.buttons = e.buttons, t.client.copyFrom(e.client), t.ctrlKey = e.ctrlKey, t.metaKey = e.metaKey, t.movement.copyFrom(e.movement), t.screen.copyFrom(e.screen), t.shiftKey = e.shiftKey, t.global.copyFrom(e.global));
		}
		copyData(e, t) {
			t.isTrusted = e.isTrusted, t.srcElement = e.srcElement, t.timeStamp = performance.now(), t.type = e.type, t.detail = e.detail, t.view = e.view, t.which = e.which, t.layer.copyFrom(e.layer), t.page.copyFrom(e.page);
		}
		trackingData(e) {
			return this.mappingState.trackingData[e] || (this.mappingState.trackingData[e] = {
				pressTargetsByButton: {},
				clicksByButton: {},
				overTarget: null
			}), this.mappingState.trackingData[e];
		}
		allocateEvent(e) {
			this.eventPool.has(e) || this.eventPool.set(e, []);
			let t = this.eventPool.get(e).pop() || new e(this);
			return t.eventPhase = t.NONE, t.currentTarget = null, t.defaultPrevented = !1, t.path = null, t.target = null, t;
		}
		freeEvent(e) {
			if (e.manager !== this) throw Error("It is illegal to free an event not managed by this EventBoundary!");
			let t = e.constructor;
			this.eventPool.has(t) || this.eventPool.set(t, []), this.eventPool.get(t).push(e);
		}
		_notifyListeners(e, t) {
			let n = e.currentTarget._events[t];
			if (n) if ("fn" in n) n.once && e.currentTarget.removeListener(t, n.fn, void 0, !0), n.fn.call(n.context, e);
			else for (let r = 0, i = n.length; r < i && !e.propagationImmediatelyStopped; r++) n[r].once && e.currentTarget.removeListener(t, n[r].fn, void 0, !0), n[r].fn.call(n[r].context, e);
		}
	};
})), $r, ei, ti, ni, ri = o((() => {
	g(), Qr(), Vr(), Gr(), qr(), $r = 1, ei = {
		touchstart: "pointerdown",
		touchend: "pointerup",
		touchendoutside: "pointerupoutside",
		touchmove: "pointermove",
		touchcancel: "pointercancel"
	}, ti = class e {
		constructor(t) {
			this.supportsTouchEvents = "ontouchstart" in globalThis, this.supportsPointerEvents = !!globalThis.PointerEvent, this.domElement = null, this.resolution = 1, this.renderer = t, this.rootBoundary = new Zr(null), Br.init(this), this.autoPreventDefault = !0, this._eventsAdded = !1, this._rootPointerEvent = new Wr(null), this._rootWheelEvent = new Kr(null), this.cursorStyles = {
				default: "inherit",
				pointer: "pointer"
			}, this.features = new Proxy({ ...e.defaultEventFeatures }, { set: (e, t, n) => (t === "globalMove" && (this.rootBoundary.enableGlobalMoveEvents = n), e[t] = n, !0) }), this._onPointerDown = this._onPointerDown.bind(this), this._onPointerMove = this._onPointerMove.bind(this), this._onPointerUp = this._onPointerUp.bind(this), this._onPointerOverOut = this._onPointerOverOut.bind(this), this.onWheel = this.onWheel.bind(this);
		}
		static get defaultEventMode() {
			return this._defaultEventMode;
		}
		init(t) {
			let { canvas: n, resolution: r } = this.renderer;
			this.setTargetElement(n), this.resolution = r, e._defaultEventMode = t.eventMode ?? "passive", Object.assign(this.features, t.eventFeatures ?? {}), this.rootBoundary.enableGlobalMoveEvents = this.features.globalMove;
		}
		resolutionChange(e) {
			this.resolution = e;
		}
		destroy() {
			Br.destroy(), this.setTargetElement(null), this.renderer = null, this._currentCursor = null;
		}
		setCursor(e) {
			e || (e = "default");
			let t = !0;
			if (globalThis.OffscreenCanvas && this.domElement instanceof OffscreenCanvas && (t = !1), this._currentCursor === e) return;
			this._currentCursor = e;
			let n = this.cursorStyles[e];
			if (n) switch (typeof n) {
				case "string":
					t && (this.domElement.style.cursor = n);
					break;
				case "function":
					n(e);
					break;
				case "object":
					t && Object.assign(this.domElement.style, n);
					break;
			}
			else t && typeof e == "string" && !Object.prototype.hasOwnProperty.call(this.cursorStyles, e) && (this.domElement.style.cursor = e);
		}
		get pointer() {
			return this._rootPointerEvent;
		}
		_onPointerDown(e) {
			if (!this.features.click) return;
			this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
			let t = this._normalizeToPointerData(e);
			this.autoPreventDefault && t[0].isNormalized && (e.cancelable || !("cancelable" in e)) && e.preventDefault();
			for (let e = 0, n = t.length; e < n; e++) {
				let n = t[e], r = this._bootstrapEvent(this._rootPointerEvent, n);
				this.rootBoundary.mapEvent(r);
			}
			this.setCursor(this.rootBoundary.cursor);
		}
		_onPointerMove(e) {
			if (!this.features.move) return;
			this.rootBoundary.rootTarget = this.renderer.lastObjectRendered, Br.pointerMoved();
			let t = this._normalizeToPointerData(e);
			for (let e = 0, n = t.length; e < n; e++) {
				let n = this._bootstrapEvent(this._rootPointerEvent, t[e]);
				this.rootBoundary.mapEvent(n);
			}
			this.setCursor(this.rootBoundary.cursor);
		}
		_onPointerUp(e) {
			if (!this.features.click) return;
			this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
			let t = e.target;
			e.composedPath && e.composedPath().length > 0 && (t = e.composedPath()[0]);
			let n = t === this.domElement ? "" : "outside", r = this._normalizeToPointerData(e);
			for (let e = 0, t = r.length; e < t; e++) {
				let t = this._bootstrapEvent(this._rootPointerEvent, r[e]);
				t.type += n, this.rootBoundary.mapEvent(t);
			}
			this.setCursor(this.rootBoundary.cursor);
		}
		_onPointerOverOut(e) {
			if (!this.features.click) return;
			this.rootBoundary.rootTarget = this.renderer.lastObjectRendered;
			let t = this._normalizeToPointerData(e);
			for (let e = 0, n = t.length; e < n; e++) {
				let n = this._bootstrapEvent(this._rootPointerEvent, t[e]);
				this.rootBoundary.mapEvent(n);
			}
			this.setCursor(this.rootBoundary.cursor);
		}
		onWheel(e) {
			if (!this.features.wheel) return;
			let t = this.normalizeWheelEvent(e);
			this.rootBoundary.rootTarget = this.renderer.lastObjectRendered, this.rootBoundary.mapEvent(t);
		}
		setTargetElement(e) {
			this._removeEvents(), this.domElement = e, Br.domElement = e, this._addEvents();
		}
		_addEvents() {
			if (this._eventsAdded || !this.domElement) return;
			Br.addTickerListener();
			let e = this.domElement.style;
			e && (globalThis.navigator.msPointerEnabled ? (e.msContentZooming = "none", e.msTouchAction = "none") : this.supportsPointerEvents && (e.touchAction = "none")), this.supportsPointerEvents ? (globalThis.document.addEventListener("pointermove", this._onPointerMove, !0), this.domElement.addEventListener("pointerdown", this._onPointerDown, !0), this.domElement.addEventListener("pointerleave", this._onPointerOverOut, !0), this.domElement.addEventListener("pointerover", this._onPointerOverOut, !0), globalThis.addEventListener("pointerup", this._onPointerUp, !0)) : (globalThis.document.addEventListener("mousemove", this._onPointerMove, !0), this.domElement.addEventListener("mousedown", this._onPointerDown, !0), this.domElement.addEventListener("mouseout", this._onPointerOverOut, !0), this.domElement.addEventListener("mouseover", this._onPointerOverOut, !0), globalThis.addEventListener("mouseup", this._onPointerUp, !0), this.supportsTouchEvents && (this.domElement.addEventListener("touchstart", this._onPointerDown, !0), this.domElement.addEventListener("touchend", this._onPointerUp, !0), this.domElement.addEventListener("touchmove", this._onPointerMove, !0))), this.domElement.addEventListener("wheel", this.onWheel, {
				passive: !0,
				capture: !0
			}), this._eventsAdded = !0;
		}
		_removeEvents() {
			if (!this._eventsAdded || !this.domElement) return;
			Br.removeTickerListener();
			let e = this.domElement.style;
			e && (globalThis.navigator.msPointerEnabled ? (e.msContentZooming = "", e.msTouchAction = "") : this.supportsPointerEvents && (e.touchAction = "")), this.supportsPointerEvents ? (globalThis.document.removeEventListener("pointermove", this._onPointerMove, !0), this.domElement.removeEventListener("pointerdown", this._onPointerDown, !0), this.domElement.removeEventListener("pointerleave", this._onPointerOverOut, !0), this.domElement.removeEventListener("pointerover", this._onPointerOverOut, !0), globalThis.removeEventListener("pointerup", this._onPointerUp, !0)) : (globalThis.document.removeEventListener("mousemove", this._onPointerMove, !0), this.domElement.removeEventListener("mousedown", this._onPointerDown, !0), this.domElement.removeEventListener("mouseout", this._onPointerOverOut, !0), this.domElement.removeEventListener("mouseover", this._onPointerOverOut, !0), globalThis.removeEventListener("mouseup", this._onPointerUp, !0), this.supportsTouchEvents && (this.domElement.removeEventListener("touchstart", this._onPointerDown, !0), this.domElement.removeEventListener("touchend", this._onPointerUp, !0), this.domElement.removeEventListener("touchmove", this._onPointerMove, !0))), this.domElement.removeEventListener("wheel", this.onWheel, !0), this.domElement = null, this._eventsAdded = !1;
		}
		mapPositionToPoint(e, t, n) {
			let r = this.domElement.isConnected ? this.domElement.getBoundingClientRect() : {
				x: 0,
				y: 0,
				width: this.domElement.width,
				height: this.domElement.height,
				left: 0,
				top: 0
			}, i = 1 / this.resolution;
			e.x = (t - r.left) * (this.domElement.width / r.width) * i, e.y = (n - r.top) * (this.domElement.height / r.height) * i;
		}
		_normalizeToPointerData(e) {
			let t = [];
			if (this.supportsTouchEvents && e instanceof TouchEvent) for (let n = 0, r = e.changedTouches.length; n < r; n++) {
				let r = e.changedTouches[n];
				r.button === void 0 && (r.button = 0), r.buttons === void 0 && (r.buttons = 1), r.isPrimary === void 0 && (r.isPrimary = e.touches.length === 1 && e.type === "touchstart"), r.width === void 0 && (r.width = r.radiusX || 1), r.height === void 0 && (r.height = r.radiusY || 1), r.tiltX === void 0 && (r.tiltX = 0), r.tiltY === void 0 && (r.tiltY = 0), r.pointerType === void 0 && (r.pointerType = "touch"), r.pointerId === void 0 && (r.pointerId = r.identifier || 0), r.pressure === void 0 && (r.pressure = r.force || .5), r.twist === void 0 && (r.twist = 0), r.tangentialPressure === void 0 && (r.tangentialPressure = 0), r.layerX === void 0 && (r.layerX = r.offsetX = r.clientX), r.layerY === void 0 && (r.layerY = r.offsetY = r.clientY), r.isNormalized = !0, r.type = e.type, r.altKey ?? (r.altKey = e.altKey), r.ctrlKey ?? (r.ctrlKey = e.ctrlKey), r.metaKey ?? (r.metaKey = e.metaKey), r.shiftKey ?? (r.shiftKey = e.shiftKey), t.push(r);
			}
			else if (!globalThis.MouseEvent || e instanceof MouseEvent && (!this.supportsPointerEvents || !(e instanceof globalThis.PointerEvent))) {
				let n = e;
				n.isPrimary === void 0 && (n.isPrimary = !0), n.width === void 0 && (n.width = 1), n.height === void 0 && (n.height = 1), n.tiltX === void 0 && (n.tiltX = 0), n.tiltY === void 0 && (n.tiltY = 0), n.pointerType === void 0 && (n.pointerType = "mouse"), n.pointerId === void 0 && (n.pointerId = $r), n.pressure === void 0 && (n.pressure = .5), n.twist === void 0 && (n.twist = 0), n.tangentialPressure === void 0 && (n.tangentialPressure = 0), n.isNormalized = !0, t.push(n);
			} else t.push(e);
			return t;
		}
		normalizeWheelEvent(e) {
			let t = this._rootWheelEvent;
			return this._transferMouseData(t, e), t.deltaX = e.deltaX, t.deltaY = e.deltaY, t.deltaZ = e.deltaZ, t.deltaMode = e.deltaMode, this.mapPositionToPoint(t.screen, e.clientX, e.clientY), t.global.copyFrom(t.screen), t.offset.copyFrom(t.screen), t.nativeEvent = e, t.type = e.type, t;
		}
		_bootstrapEvent(e, t) {
			return e.originalEvent = null, e.nativeEvent = t, e.pointerId = t.pointerId, e.width = t.width, e.height = t.height, e.isPrimary = t.isPrimary, e.pointerType = t.pointerType, e.pressure = t.pressure, e.tangentialPressure = t.tangentialPressure, e.tiltX = t.tiltX, e.tiltY = t.tiltY, e.twist = t.twist, this._transferMouseData(e, t), this.mapPositionToPoint(e.screen, t.clientX, t.clientY), e.global.copyFrom(e.screen), e.offset.copyFrom(e.screen), e.isTrusted = t.isTrusted, e.type === "pointerleave" && (e.type = "pointerout"), e.type.startsWith("mouse") && (e.type = e.type.replace("mouse", "pointer")), e.type.startsWith("touch") && (e.type = ei[e.type] || e.type), e;
		}
		_transferMouseData(e, t) {
			e.isTrusted = t.isTrusted, e.srcElement = t.srcElement, e.timeStamp = performance.now(), e.type = t.type, e.altKey = t.altKey, e.button = t.button, e.buttons = t.buttons, e.client.x = t.clientX, e.client.y = t.clientY, e.ctrlKey = t.ctrlKey, e.metaKey = t.metaKey, e.movement.x = t.movementX, e.movement.y = t.movementY, e.page.x = t.pageX, e.page.y = t.pageY, e.relatedTarget = null, e.shiftKey = t.shiftKey;
		}
	}, ti.extension = {
		name: "events",
		type: [
			f.WebGLSystem,
			f.CanvasSystem,
			f.WebGPUSystem
		],
		priority: -1
	}, ti.defaultEventFeatures = {
		move: !0,
		globalMove: !0,
		click: !0,
		wheel: !0
	}, ni = ti;
})), ii, ai = o((() => {
	ri(), Xn(), ii = {
		onclick: null,
		onmousedown: null,
		onmouseenter: null,
		onmouseleave: null,
		onmousemove: null,
		onglobalmousemove: null,
		onmouseout: null,
		onmouseover: null,
		onmouseup: null,
		onmouseupoutside: null,
		onpointercancel: null,
		onpointerdown: null,
		onpointerenter: null,
		onpointerleave: null,
		onpointermove: null,
		onglobalpointermove: null,
		onpointerout: null,
		onpointerover: null,
		onpointertap: null,
		onpointerup: null,
		onpointerupoutside: null,
		onrightclick: null,
		onrightdown: null,
		onrightup: null,
		onrightupoutside: null,
		ontap: null,
		ontouchcancel: null,
		ontouchend: null,
		ontouchendoutside: null,
		ontouchmove: null,
		onglobaltouchmove: null,
		ontouchstart: null,
		onwheel: null,
		get interactive() {
			return this.eventMode === "dynamic" || this.eventMode === "static";
		},
		set interactive(e) {
			this.eventMode = e ? "static" : "passive";
		},
		_internalEventMode: void 0,
		get eventMode() {
			return this._internalEventMode ?? ni.defaultEventMode;
		},
		set eventMode(e) {
			this._internalEventMode = e;
		},
		isInteractive() {
			return this.eventMode === "static" || this.eventMode === "dynamic";
		},
		interactiveChildren: !0,
		hitArea: null,
		addEventListener(e, t, n) {
			let r = typeof n == "boolean" && n || typeof n == "object" && n.capture, i = typeof n == "object" ? n.signal : void 0, a = typeof n == "object" ? n.once === !0 : !1, o = typeof t == "function" ? void 0 : t;
			e = r ? `${e}capture` : e;
			let s = typeof t == "function" ? t : t.handleEvent, c = this;
			i && i.addEventListener("abort", () => {
				c.off(e, s, o);
			}), a ? c.once(e, s, o) : c.on(e, s, o);
		},
		removeEventListener(e, t, n) {
			let r = typeof n == "boolean" && n || typeof n == "object" && n.capture, i = typeof t == "function" ? void 0 : t;
			e = r ? `${e}capture` : e, t = typeof t == "function" ? t : t.handleEvent, this.off(e, t, i);
		},
		dispatchEvent(e) {
			if (!(e instanceof Yn)) throw Error("Container cannot propagate events outside of the Federated Events API");
			return e.defaultPrevented = !1, e.path = null, e.target = this, e.manager.dispatchEvent(e), !e.defaultPrevented;
		}
	};
})), oi = o((() => {
	g(), zn(), ri(), ai(), h.add(ni), h.mixin(Rn, ii);
})), si, ci = o((() => {
	si = /* @__PURE__ */ ((e) => (e[e.Low = 0] = "Low", e[e.Normal = 1] = "Normal", e[e.High = 2] = "High", e))(si || {});
})), li, ui = o((() => {
	li = {
		createCanvas: (e, t) => {
			let n = document.createElement("canvas");
			return n.width = e, n.height = t, n;
		},
		createImage: () => new Image(),
		getCanvasRenderingContext2D: () => CanvasRenderingContext2D,
		getWebGLRenderingContext: () => WebGLRenderingContext,
		getNavigator: () => navigator,
		getBaseUrl: () => document.baseURI ?? window.location.href,
		getFontFaceSet: () => document.fonts,
		fetch: (e, t) => fetch(e, t),
		parseXML: (e) => new DOMParser().parseFromString(e, "text/xml")
	};
})), di, J, Y = o((() => {
	ui(), di = li, J = {
		get() {
			return di;
		},
		set(e) {
			di = e;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/path.mjs
function fi(e) {
	if (typeof e != "string") throw TypeError(`Path must be a string. Received ${JSON.stringify(e)}`);
}
function pi(e) {
	return e.split("?")[0].split("#")[0];
}
function mi(e) {
	return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hi(e, t, n) {
	return e.replace(new RegExp(mi(t), "g"), n);
}
function gi(e, t) {
	let n = "", r = 0, i = -1, a = 0, o = -1;
	for (let s = 0; s <= e.length; ++s) {
		if (s < e.length) o = e.charCodeAt(s);
		else if (o === 47) break;
		else o = 47;
		if (o === 47) {
			if (!(i === s - 1 || a === 1)) if (i !== s - 1 && a === 2) {
				if (n.length < 2 || r !== 2 || n.charCodeAt(n.length - 1) !== 46 || n.charCodeAt(n.length - 2) !== 46) {
					if (n.length > 2) {
						let e = n.lastIndexOf("/");
						if (e !== n.length - 1) {
							e === -1 ? (n = "", r = 0) : (n = n.slice(0, e), r = n.length - 1 - n.lastIndexOf("/")), i = s, a = 0;
							continue;
						}
					} else if (n.length === 2 || n.length === 1) {
						n = "", r = 0, i = s, a = 0;
						continue;
					}
				}
				t && (n.length > 0 ? n += "/.." : n = "..", r = 2);
			} else n.length > 0 ? n += `/${e.slice(i + 1, s)}` : n = e.slice(i + 1, s), r = s - i - 1;
			i = s, a = 0;
		} else o === 46 && a !== -1 ? ++a : a = -1;
	}
	return n;
}
var _i, vi = o((() => {
	Y(), _i = {
		toPosix(e) {
			return hi(e, "\\", "/");
		},
		isUrl(e) {
			return /^https?:/.test(this.toPosix(e));
		},
		isDataUrl(e) {
			return /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z0-9-.!#$%*+.{}|~`]+=[a-z0-9-.!#$%*+.{}()_|~`]+)*)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s<>]*?)$/i.test(e);
		},
		isBlobUrl(e) {
			return e.startsWith("blob:");
		},
		hasProtocol(e) {
			return /^[^/:]+:/.test(this.toPosix(e));
		},
		getProtocol(e) {
			fi(e), e = this.toPosix(e);
			let t = /^file:\/\/\//.exec(e);
			if (t) return t[0];
			let n = /^[^/:]+:\/{0,2}/.exec(e);
			return n ? n[0] : "";
		},
		toAbsolute(e, t, n) {
			if (fi(e), this.isDataUrl(e) || this.isBlobUrl(e)) return e;
			let r = pi(this.toPosix(t ?? J.get().getBaseUrl())), i = pi(this.toPosix(n ?? this.rootname(r)));
			return e = this.toPosix(e), e.startsWith("/") ? _i.join(i, e.slice(1)) : this.isAbsolute(e) ? e : this.join(r, e);
		},
		normalize(e) {
			if (fi(e), e.length === 0) return ".";
			if (this.isDataUrl(e) || this.isBlobUrl(e)) return e;
			e = this.toPosix(e);
			let t = "", n = e.startsWith("/");
			this.hasProtocol(e) && (t = this.rootname(e), e = e.slice(t.length));
			let r = e.endsWith("/");
			return e = gi(e, !1), e.length > 0 && r && (e += "/"), n ? `/${e}` : t + e;
		},
		isAbsolute(e) {
			return fi(e), e = this.toPosix(e), this.hasProtocol(e) ? !0 : e.startsWith("/");
		},
		join(...e) {
			if (e.length === 0) return ".";
			let t;
			for (let n = 0; n < e.length; ++n) {
				let r = e[n];
				if (fi(r), r.length > 0) if (t === void 0) t = r;
				else {
					let i = e[n - 1] ?? "";
					this.joinExtensions.includes(this.extname(i).toLowerCase()) ? t += `/../${r}` : t += `/${r}`;
				}
			}
			return t === void 0 ? "." : this.normalize(t);
		},
		dirname(e) {
			if (fi(e), e.length === 0) return ".";
			e = this.toPosix(e);
			let t = e.charCodeAt(0), n = t === 47, r = -1, i = !0, a = this.getProtocol(e), o = e;
			e = e.slice(a.length);
			for (let n = e.length - 1; n >= 1; --n) if (t = e.charCodeAt(n), t === 47) {
				if (!i) {
					r = n;
					break;
				}
			} else i = !1;
			return r === -1 ? n ? "/" : this.isUrl(o) ? a + e : a : n && r === 1 ? "//" : a + e.slice(0, r);
		},
		rootname(e) {
			fi(e), e = this.toPosix(e);
			let t = "";
			if (t = e.startsWith("/") ? "/" : this.getProtocol(e), this.isUrl(e)) {
				let n = e.indexOf("/", t.length);
				t = n === -1 ? e : e.slice(0, n), t.endsWith("/") || (t += "/");
			}
			return t;
		},
		basename(e, t) {
			fi(e), t && fi(t), e = pi(this.toPosix(e));
			let n = 0, r = -1, i = !0, a;
			if (t !== void 0 && t.length > 0 && t.length <= e.length) {
				if (t.length === e.length && t === e) return "";
				let o = t.length - 1, s = -1;
				for (a = e.length - 1; a >= 0; --a) {
					let c = e.charCodeAt(a);
					if (c === 47) {
						if (!i) {
							n = a + 1;
							break;
						}
					} else s === -1 && (i = !1, s = a + 1), o >= 0 && (c === t.charCodeAt(o) ? --o === -1 && (r = a) : (o = -1, r = s));
				}
				return n === r ? r = s : r === -1 && (r = e.length), e.slice(n, r);
			}
			for (a = e.length - 1; a >= 0; --a) if (e.charCodeAt(a) === 47) {
				if (!i) {
					n = a + 1;
					break;
				}
			} else r === -1 && (i = !1, r = a + 1);
			return r === -1 ? "" : e.slice(n, r);
		},
		extname(e) {
			fi(e), e = pi(this.toPosix(e));
			let t = -1, n = 0, r = -1, i = !0, a = 0;
			for (let o = e.length - 1; o >= 0; --o) {
				let s = e.charCodeAt(o);
				if (s === 47) {
					if (!i) {
						n = o + 1;
						break;
					}
					continue;
				}
				r === -1 && (i = !1, r = o + 1), s === 46 ? t === -1 ? t = o : a !== 1 && (a = 1) : t !== -1 && (a = -1);
			}
			return t === -1 || r === -1 || a === 0 || a === 1 && t === r - 1 && t === n + 1 ? "" : e.slice(t, r);
		},
		parse(e) {
			fi(e);
			let t = {
				root: "",
				dir: "",
				base: "",
				ext: "",
				name: ""
			};
			if (e.length === 0) return t;
			e = pi(this.toPosix(e));
			let n = e.charCodeAt(0), r = this.isAbsolute(e), i;
			t.root = this.rootname(e), i = r || this.hasProtocol(e) ? 1 : 0;
			let a = -1, o = 0, s = -1, c = !0, l = e.length - 1, u = 0;
			for (; l >= i; --l) {
				if (n = e.charCodeAt(l), n === 47) {
					if (!c) {
						o = l + 1;
						break;
					}
					continue;
				}
				s === -1 && (c = !1, s = l + 1), n === 46 ? a === -1 ? a = l : u !== 1 && (u = 1) : a !== -1 && (u = -1);
			}
			return a === -1 || s === -1 || u === 0 || u === 1 && a === s - 1 && a === o + 1 ? s !== -1 && (o === 0 && r ? t.base = t.name = e.slice(1, s) : t.base = t.name = e.slice(o, s)) : (o === 0 && r ? (t.name = e.slice(1, a), t.base = e.slice(1, s)) : (t.name = e.slice(o, a), t.base = e.slice(o, s)), t.ext = e.slice(a, s)), t.dir = this.dirname(e), t;
		},
		sep: "/",
		delimiter: ":",
		joinExtensions: [".html"]
	};
})), yi, bi = o((() => {
	yi = (e, t, n = !1) => (Array.isArray(e) || (e = [e]), t ? e.map((e) => typeof e == "string" || n ? t(e) : e) : e);
}));
//#endregion
//#region node_modules/pixi.js/lib/assets/utils/createStringVariations.mjs
function xi(e, t, n, r, i) {
	let a = t[n];
	for (let o = 0; o < a.length; o++) {
		let s = a[o];
		n < t.length - 1 ? xi(e.replace(r[n], s), t, n + 1, r, i) : i.push(e.replace(r[n], s));
	}
}
function Si(e) {
	let t = e.match(/\{(.*?)\}/g), n = [];
	if (t) {
		let r = [];
		t.forEach((e) => {
			let t = e.substring(1, e.length - 1).split(",");
			r.push(t);
		}), xi(e, r, 0, t, n);
	} else n.push(e);
	return n;
}
var Ci = o((() => {})), wi, Ti = o((() => {
	wi = (e) => !Array.isArray(e);
}));
//#endregion
//#region node_modules/pixi.js/lib/assets/resolver/Resolver.mjs
function Ei(e) {
	return e.split(".").pop().split("?").shift().split("#").shift();
}
var Di, Oi = o((() => {
	U(), vi(), bi(), Ci(), Ti(), Di = class {
		constructor() {
			this._defaultBundleIdentifierOptions = {
				connector: "-",
				createBundleAssetId: (e, t) => `${e}${this._bundleIdConnector}${t}`,
				extractAssetIdFromBundle: (e, t) => t.replace(`${e}${this._bundleIdConnector}`, "")
			}, this._bundleIdConnector = this._defaultBundleIdentifierOptions.connector, this._createBundleAssetId = this._defaultBundleIdentifierOptions.createBundleAssetId, this._extractAssetIdFromBundle = this._defaultBundleIdentifierOptions.extractAssetIdFromBundle, this._assetMap = {}, this._preferredOrder = [], this._parsers = [], this._resolverHash = {}, this._bundles = {};
		}
		setBundleIdentifier(e) {
			if (this._bundleIdConnector = e.connector ?? this._bundleIdConnector, this._createBundleAssetId = e.createBundleAssetId ?? this._createBundleAssetId, this._extractAssetIdFromBundle = e.extractAssetIdFromBundle ?? this._extractAssetIdFromBundle, this._extractAssetIdFromBundle("foo", this._createBundleAssetId("foo", "bar")) !== "bar") throw Error("[Resolver] GenerateBundleAssetId are not working correctly");
		}
		prefer(...e) {
			e.forEach((e) => {
				this._preferredOrder.push(e), e.priority || (e.priority = Object.keys(e.params));
			}), this._resolverHash = {};
		}
		set basePath(e) {
			this._basePath = e;
		}
		get basePath() {
			return this._basePath;
		}
		set rootPath(e) {
			this._rootPath = e;
		}
		get rootPath() {
			return this._rootPath;
		}
		get parsers() {
			return this._parsers;
		}
		reset() {
			this.setBundleIdentifier(this._defaultBundleIdentifierOptions), this._assetMap = {}, this._preferredOrder = [], this._resolverHash = {}, this._rootPath = null, this._basePath = null, this._manifest = null, this._bundles = {}, this._defaultSearchParams = null;
		}
		setDefaultSearchParams(e) {
			if (typeof e == "string") this._defaultSearchParams = e;
			else {
				let t = e;
				this._defaultSearchParams = Object.keys(t).map((e) => `${encodeURIComponent(e)}=${encodeURIComponent(t[e])}`).join("&");
			}
		}
		getAlias(e) {
			let { alias: t, src: n } = e;
			return yi(t || n, (e) => typeof e == "string" ? e : Array.isArray(e) ? e.map((e) => e?.src ?? e) : e?.src ? e.src : e, !0);
		}
		removeAlias(e, t) {
			this._assetMap[e] && (t && t !== this._resolverHash[e] || (delete this._resolverHash[e], delete this._assetMap[e]));
		}
		addManifest(e) {
			this._manifest && H("[Resolver] Manifest already exists, this will be overwritten"), this._manifest = e, e.bundles.forEach((e) => {
				this.addBundle(e.name, e.assets);
			});
		}
		addBundle(e, t) {
			let n = [], r = t;
			Array.isArray(t) || (r = Object.entries(t).map(([e, t]) => typeof t == "string" || Array.isArray(t) ? {
				alias: e,
				src: t
			} : {
				alias: e,
				...t
			})), r.forEach((t) => {
				let r = t.src, i = t.alias, a;
				if (typeof i == "string") {
					let t = this._createBundleAssetId(e, i);
					n.push(t), a = [i, t];
				} else {
					let t = i.map((t) => this._createBundleAssetId(e, t));
					n.push(...t), a = [...i, ...t];
				}
				this.add({
					...t,
					alias: a,
					src: r
				});
			}), this._bundles[e] = n;
		}
		add(e) {
			let t = [];
			Array.isArray(e) ? t.push(...e) : t.push(e);
			let n = (e) => {
				this.hasKey(e) && H(`[Resolver] already has key: ${e} overwriting`);
			};
			yi(t).forEach((e) => {
				let { src: t } = e, { data: r, format: i, loadParser: a, parser: o } = e, s = yi(t).map((e) => typeof e == "string" ? Si(e) : Array.isArray(e) ? e : [e]), c = this.getAlias(e);
				Array.isArray(c) ? c.forEach(n) : n(c);
				let l = [], u = (e) => ({
					src: e,
					...this._parsers.find((t) => t.test(e))?.parse(e)
				});
				s.forEach((t) => {
					t.forEach((t) => {
						let n = {};
						if (typeof t == "object" ? (r = t.data ?? r, i = t.format ?? i, (t.loadParser || t.parser) && (a = t.loadParser ?? a, o = t.parser ?? o), n = {
							...u(t.src),
							...t
						}) : n = u(t), !c) throw Error(`[Resolver] alias is undefined for this asset: ${n.src}`);
						n = this._buildResolvedAsset(n, {
							aliases: c,
							data: r,
							format: i,
							loadParser: a,
							parser: o,
							progressSize: e.progressSize
						}), l.push(n);
					});
				}), c.forEach((e) => {
					this._assetMap[e] = l;
				});
			});
		}
		resolveBundle(e) {
			let t = wi(e);
			e = yi(e);
			let n = {};
			return e.forEach((e) => {
				let t = this._bundles[e];
				if (t) {
					let r = this.resolve(t), i = {};
					for (let t in r) {
						let n = r[t];
						i[this._extractAssetIdFromBundle(e, t)] = n;
					}
					n[e] = i;
				}
			}), t ? n[e[0]] : n;
		}
		resolveUrl(e) {
			let t = this.resolve(e);
			if (typeof e != "string") {
				let e = {};
				for (let n in t) e[n] = t[n].src;
				return e;
			}
			return t.src;
		}
		resolve(e) {
			let t = wi(e);
			e = yi(e);
			let n = {};
			return e.forEach((e) => {
				if (!this._resolverHash[e]) if (this._assetMap[e]) {
					let t = this._assetMap[e], n = this._getPreferredOrder(t);
					n?.priority.forEach((e) => {
						n.params[e].forEach((n) => {
							let r = t.filter((t) => t[e] ? t[e] === n : !1);
							r.length && (t = r);
						});
					}), this._resolverHash[e] = t[0];
				} else this._resolverHash[e] = this._buildResolvedAsset({
					alias: [e],
					src: e
				}, {});
				n[e] = this._resolverHash[e];
			}), t ? n[e[0]] : n;
		}
		hasKey(e) {
			return !!this._assetMap[e];
		}
		hasBundle(e) {
			return !!this._bundles[e];
		}
		_getPreferredOrder(e) {
			for (let t = 0; t < e.length; t++) {
				let n = e[t], r = this._preferredOrder.find((e) => e.params.format.includes(n.format));
				if (r) return r;
			}
			return this._preferredOrder[0];
		}
		_appendDefaultSearchParams(e) {
			return this._defaultSearchParams ? `${e}${/\?/.test(e) ? "&" : "?"}${this._defaultSearchParams}` : e;
		}
		_buildResolvedAsset(e, t) {
			let { aliases: n, data: r, loadParser: i, parser: a, format: o, progressSize: s } = t;
			return (this._basePath || this._rootPath) && (e.src = _i.toAbsolute(e.src, this._basePath, this._rootPath)), e.alias = n ?? e.alias ?? [e.src], e.src = this._appendDefaultSearchParams(e.src), e.data = {
				...r || {},
				...e.data
			}, e.loadParser = i ?? e.loadParser, e.parser = a ?? e.parser, e.format = o ?? e.format ?? Ei(e.src), s !== void 0 && (e.progressSize = s), e;
		}
	}, Di.RETINA_PREFIX = /@([0-9\.]+)x/;
})), ki, Ai = o((() => {
	ki = (e, t) => {
		let n = t.split("?")[1];
		return n && (e += `?${n}`), e;
	};
})), ji, Mi, Ni = o((() => {
	dt(), ln(), q(), ji = class e {
		constructor(e, t) {
			this.linkedSheets = [];
			let n = e;
			e?.source instanceof cn && (n = {
				texture: e,
				data: t
			});
			let { texture: r, data: i, cachePrefix: a = "" } = n;
			this.cachePrefix = a, this._texture = r instanceof K ? r : null, this.textureSource = r.source, this.textures = {}, this.animations = {}, this.data = i;
			let o = parseFloat(i.meta.scale);
			o ? (this.resolution = o, r.source.resolution = this.resolution) : this.resolution = r.source._resolution, this._frames = this.data.frames, this._frameKeys = Object.keys(this._frames), this._batchIndex = 0, this._callback = null;
		}
		parse() {
			return new Promise((t) => {
				this._callback = t, this._batchIndex = 0, this._frameKeys.length <= e.BATCH_SIZE ? (this._processFrames(0), this._processAnimations(), this._parseComplete()) : this._nextBatch();
			});
		}
		parseSync() {
			return this._processFrames(0, !0), this._processAnimations(), this.textures;
		}
		_processFrames(t, n = !1) {
			let r = t, i = n ? Infinity : e.BATCH_SIZE;
			for (; r - t < i && r < this._frameKeys.length;) {
				let e = this._frameKeys[r], t = this._frames[e], n = t.frame;
				if (n) {
					let r = null, i = null, a = t.trimmed !== !1 && t.sourceSize ? t.sourceSize : t.frame, o = new W(0, 0, Math.floor(a.w) / this.resolution, Math.floor(a.h) / this.resolution);
					r = t.rotated ? new W(Math.floor(n.x) / this.resolution, Math.floor(n.y) / this.resolution, Math.floor(n.h) / this.resolution, Math.floor(n.w) / this.resolution) : new W(Math.floor(n.x) / this.resolution, Math.floor(n.y) / this.resolution, Math.floor(n.w) / this.resolution, Math.floor(n.h) / this.resolution), t.trimmed !== !1 && t.spriteSourceSize && (i = new W(Math.floor(t.spriteSourceSize.x) / this.resolution, Math.floor(t.spriteSourceSize.y) / this.resolution, Math.floor(n.w) / this.resolution, Math.floor(n.h) / this.resolution)), this.textures[e] = new K({
						source: this.textureSource,
						frame: r,
						orig: o,
						trim: i,
						rotate: t.rotated ? 2 : 0,
						defaultAnchor: t.anchor,
						defaultBorders: t.borders,
						label: e.toString()
					});
				}
				r++;
			}
		}
		_processAnimations() {
			let e = this.data.animations || {};
			for (let t in e) {
				this.animations[t] = [];
				for (let n = 0; n < e[t].length; n++) {
					let r = e[t][n];
					this.animations[t].push(this.textures[r]);
				}
			}
		}
		_parseComplete() {
			let e = this._callback;
			this._callback = null, this._batchIndex = 0, e.call(this, this.textures);
		}
		_nextBatch() {
			this._processFrames(this._batchIndex * e.BATCH_SIZE), this._batchIndex++, setTimeout(() => {
				this._batchIndex * e.BATCH_SIZE < this._frameKeys.length ? this._nextBatch() : (this._processAnimations(), this._parseComplete());
			}, 0);
		}
		destroy(e = !1) {
			for (let e in this.textures) this.textures[e].destroy();
			this._frames = null, this._frameKeys = null, this.data = null, this.textures = null, e && (this._texture?.destroy(), this.textureSource.destroy()), this._texture = null, this.textureSource = null, this.linkedSheets = [];
		}
	}, ji.BATCH_SIZE = 1e3, Mi = ji;
}));
//#endregion
//#region node_modules/pixi.js/lib/spritesheet/spritesheetAsset.mjs
function Pi(e, t, n) {
	let r = {};
	if (e.forEach((e) => {
		r[e] = t;
	}), Object.keys(t.textures).forEach((e) => {
		r[`${t.cachePrefix}${e}`] = t.textures[e];
	}), !n) {
		let n = _i.dirname(e[0]);
		t.linkedSheets.forEach((e, i) => {
			let a = Pi([`${n}/${t.data.meta.related_multi_packs[i]}`], e, !0);
			Object.assign(r, a);
		});
	}
	return r;
}
var Fi, Ii, Li = o((() => {
	ci(), Oi(), Ai(), g(), q(), vi(), Ni(), Fi = [
		"jpg",
		"png",
		"jpeg",
		"avif",
		"webp",
		"basis",
		"etc2",
		"bc7",
		"bc6h",
		"bc5",
		"bc4",
		"bc3",
		"bc2",
		"bc1",
		"eac",
		"astc"
	], Ii = {
		extension: f.Asset,
		cache: {
			test: (e) => e instanceof Mi,
			getCacheableAssets: (e, t) => Pi(e, t, !1)
		},
		resolver: {
			extension: {
				type: f.ResolveParser,
				name: "resolveSpritesheet"
			},
			test: (e) => {
				let t = e.split("?")[0].split("."), n = t.pop(), r = t.pop();
				return n === "json" && Fi.includes(r);
			},
			parse: (e) => {
				let t = e.split(".");
				return {
					resolution: parseFloat(Di.RETINA_PREFIX.exec(e)?.[1] ?? "1"),
					format: t[t.length - 2],
					src: e
				};
			}
		},
		loader: {
			name: "spritesheetLoader",
			id: "spritesheet",
			extension: {
				type: f.LoadParser,
				priority: si.Normal,
				name: "spritesheetLoader"
			},
			async testParse(e, t) {
				return _i.extname(t.src).toLowerCase() === ".json" && !!e.frames;
			},
			async parse(e, t, n) {
				let { texture: r, imageFilename: i, textureOptions: a, cachePrefix: o } = t?.data ?? {}, s = _i.dirname(t.src);
				s && s.lastIndexOf("/") !== s.length - 1 && (s += "/");
				let c;
				if (r instanceof K) c = r;
				else {
					let r = ki(s + (i ?? e.meta.image), t.src);
					c = (await n.load([{
						src: r,
						data: a
					}]))[r];
				}
				let l = new Mi({
					texture: c.source,
					data: e,
					cachePrefix: o
				});
				await l.parse();
				let u = e?.meta?.related_multi_packs;
				if (Array.isArray(u)) {
					let e = [];
					for (let r of u) {
						if (typeof r != "string") continue;
						let i = s + r;
						t.data?.ignoreMultiPack || (i = ki(i, t.src), e.push(n.load({
							src: i,
							data: {
								textureOptions: a,
								ignoreMultiPack: !0
							}
						})));
					}
					let r = await Promise.all(e);
					l.linkedSheets = r, r.forEach((e) => {
						e.linkedSheets = [l].concat(l.linkedSheets.filter((t) => t !== e));
					});
				}
				return l;
			},
			async unload(e, t, n) {
				await n.unload(e.textureSource._sourceOrigin), e.destroy(!1);
			}
		}
	};
})), Ri = o((() => {
	g(), Li(), h.add(Ii);
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/data/updateQuadBounds.mjs
function zi(e, t, n) {
	let { width: r, height: i } = n.orig, a = n.trim;
	if (a) {
		let n = a.width, o = a.height;
		e.minX = a.x - t._x * r, e.maxX = e.minX + n, e.minY = a.y - t._y * i, e.maxY = e.minY + o;
	} else e.minX = -t._x * r, e.maxX = e.minX + r, e.minY = -t._y * i, e.maxY = e.minY + i;
}
var Bi = o((() => {})), Vi, Hi = o((() => {
	je(), q(), Bi(), Le(), Lr(), Vi = class e extends Ir {
		constructor(e = K.EMPTY) {
			e instanceof K && (e = { texture: e });
			let { texture: t = K.EMPTY, anchor: n, roundPixels: r, width: i, height: a, ...o } = e;
			super({
				label: "Sprite",
				...o
			}), this.renderPipeId = "sprite", this.batched = !0, this._visualBounds = {
				minX: 0,
				maxX: 1,
				minY: 0,
				maxY: 0
			}, this._anchor = new Ae({ _onUpdate: () => {
				this.onViewUpdate();
			} }), n ? this.anchor = n : t.defaultAnchor && (this.anchor = t.defaultAnchor), this.texture = t, this.allowChildren = !1, this.roundPixels = r ?? !1, i !== void 0 && (this.width = i), a !== void 0 && (this.height = a);
		}
		static from(t, n = !1) {
			return t instanceof K ? new e(t) : new e(K.from(t, n));
		}
		set texture(e) {
			e || (e = K.EMPTY);
			let t = this._texture;
			t !== e && (t && t.dynamic && t.off("update", this.onViewUpdate, this), e.dynamic && e.on("update", this.onViewUpdate, this), this._texture = e, this._width && this._setWidth(this._width, this._texture.orig.width), this._height && this._setHeight(this._height, this._texture.orig.height), this.onViewUpdate());
		}
		get texture() {
			return this._texture;
		}
		get visualBounds() {
			return zi(this._visualBounds, this._anchor, this._texture), this._visualBounds;
		}
		get sourceBounds() {
			return V("8.6.1", "Sprite.sourceBounds is deprecated, use visualBounds instead."), this.visualBounds;
		}
		updateBounds() {
			let e = this._anchor, t = this._texture, n = this._bounds, { width: r, height: i } = t.orig;
			n.minX = -e._x * r, n.maxX = n.minX + r, n.minY = -e._y * i, n.maxY = n.minY + i;
		}
		destroy(e = !1) {
			if (super.destroy(e), typeof e == "boolean" ? e : e?.texture) {
				let t = typeof e == "boolean" ? e : e?.textureSource;
				this._texture.destroy(t);
			}
			this._texture = null, this._visualBounds = null, this._bounds = null, this._anchor = null;
		}
		get anchor() {
			return this._anchor;
		}
		set anchor(e) {
			typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
		}
		get width() {
			return Math.abs(this.scale.x) * this._texture.orig.width;
		}
		set width(e) {
			this._setWidth(e, this._texture.orig.width), this._width = e;
		}
		get height() {
			return Math.abs(this.scale.y) * this._texture.orig.height;
		}
		set height(e) {
			this._setHeight(e, this._texture.orig.height), this._height = e;
		}
		getSize(e) {
			return e || (e = {}), e.width = Math.abs(this.scale.x) * this._texture.orig.width, e.height = Math.abs(this.scale.y) * this._texture.orig.height, e;
		}
		setSize(e, t) {
			typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ?? (t = e), e !== void 0 && this._setWidth(e, this._texture.orig.width), t !== void 0 && this._setHeight(t, this._texture.orig.height);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/mask/utils/addMaskBounds.mjs
function Ui(e, t, n) {
	let r = Wi;
	e.measurable = !0, xt(e, n, r), t.addBoundsMask(r), e.measurable = !1;
}
var Wi, Gi = o((() => {
	mt(), wt(), Wi = new pt();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/mask/utils/addMaskLocalBounds.mjs
function Ki(e, t, n) {
	let r = gt.get();
	e.measurable = !0;
	let i = ht.get().identity();
	Nt(e, r, qi(e, n, i)), e.measurable = !1, t.addBoundsMask(r), ht.return(i), gt.return(r);
}
function qi(e, t, n) {
	return e ? (e !== t && (qi(e.parent, t, n), e.updateLocalTransform(), n.append(e.localTransform)), n) : (H("Mask bounds, renderable is not inside the root container"), n);
}
var Ji = o((() => {
	Ft(), _t(), U();
})), Yi, Xi = o((() => {
	g(), Hi(), Gi(), Ji(), Yi = class {
		constructor(e) {
			this.priority = 0, this.inverse = !1, this.pipe = "alphaMask", e?.mask && this.init(e.mask);
		}
		init(e) {
			this.mask = e, this.renderMaskToTexture = !(e instanceof Vi), this.mask.renderable = this.renderMaskToTexture, this.mask.includeInBuild = !this.renderMaskToTexture, this.mask.measurable = !1;
		}
		reset() {
			this.mask !== null && (this.mask.measurable = !0, this.mask = null);
		}
		addBounds(e, t) {
			this.inverse || Ui(this.mask, e, t);
		}
		addLocalBounds(e, t) {
			Ki(this.mask, e, t);
		}
		containsPoint(e, t) {
			let n = this.mask;
			return t(n, e);
		}
		destroy() {
			this.reset();
		}
		static test(e) {
			return e instanceof Vi;
		}
	}, Yi.extension = f.MaskEffect;
})), Zi, Qi = o((() => {
	g(), Zi = class {
		constructor(e) {
			this.priority = 0, this.pipe = "colorMask", e?.mask && this.init(e.mask);
		}
		init(e) {
			this.mask = e;
		}
		destroy() {}
		static test(e) {
			return typeof e == "number";
		}
	}, Zi.extension = f.MaskEffect;
})), $i, ea = o((() => {
	g(), zn(), Gi(), Ji(), $i = class {
		constructor(e) {
			this.priority = 0, this.pipe = "stencilMask", e?.mask && this.init(e.mask);
		}
		init(e) {
			this.mask = e, this.mask.includeInBuild = !1, this.mask.measurable = !1;
		}
		reset() {
			this.mask !== null && (this.mask.measurable = !0, this.mask.includeInBuild = !0, this.mask = null);
		}
		addBounds(e, t) {
			Ui(this.mask, e, t);
		}
		addLocalBounds(e, t) {
			Ki(this.mask, e, t);
		}
		containsPoint(e, t) {
			let n = this.mask;
			return t(n, e);
		}
		destroy() {
			this.reset();
		}
		static test(e) {
			return e instanceof Rn;
		}
	}, $i.extension = f.MaskEffect;
})), ta, na = o((() => {
	Y(), g(), ln(), ta = class extends cn {
		constructor(e) {
			e.resource || (e.resource = J.get().createCanvas()), e.width || (e.width = e.resource.width, e.autoDensity || (e.width /= e.resolution)), e.height || (e.height = e.resource.height, e.autoDensity || (e.height /= e.resolution)), super(e), this.uploadMethodId = "image", this.autoDensity = e.autoDensity, this.resizeCanvas(), this.transparent = !!e.transparent;
		}
		resizeCanvas() {
			this.autoDensity && "style" in this.resource && (this.resource.style.width = `${this.width}px`, this.resource.style.height = `${this.height}px`), (this.resource.width !== this.pixelWidth || this.resource.height !== this.pixelHeight) && (this.resource.width = this.pixelWidth, this.resource.height = this.pixelHeight);
		}
		resize(e = this.width, t = this.height, n = this._resolution) {
			let r = super.resize(e, t, n);
			return r && this.resizeCanvas(), r;
		}
		static test(e) {
			return globalThis.HTMLCanvasElement && e instanceof HTMLCanvasElement || globalThis.OffscreenCanvas && e instanceof OffscreenCanvas;
		}
		get context2D() {
			return this._context2D || (this._context2D = this.resource.getContext("2d"));
		}
	}, ta.extension = f.TextureSource;
})), ra, ia = o((() => {
	g(), ln(), ra = class extends cn {
		constructor(e) {
			super(e), this.uploadMethodId = "image", this.autoGarbageCollect = !0;
		}
		static test(e) {
			return globalThis.HTMLImageElement && e instanceof HTMLImageElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap || globalThis.VideoFrame && e instanceof VideoFrame;
		}
	}, ra.extension = f.TextureSource;
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/browser/detectVideoAlphaMode.mjs
async function aa() {
	return oa ?? (oa = (async () => {
		let e = J.get().createCanvas(1, 1).getContext("webgl");
		if (!e) return "premultiply-alpha-on-upload";
		let t = await new Promise((e) => {
			let t = document.createElement("video");
			t.onloadeddata = () => e(t), t.onerror = () => e(null), t.autoplay = !1, t.crossOrigin = "anonymous", t.preload = "auto", t.src = "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHTEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHGTbuMU6uEElTDZ1OsggEXTbuMU6uEHFO7a1OsggG97AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmoCrXsYMPQkBNgIRMYXZmV0GETGF2ZkSJiEBEAAAAAAAAFlSua8yuAQAAAAAAAEPXgQFzxYgAAAAAAAAAAZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhAJiWgDglLCBArqBApqBAlPAgQFVsIRVuYEBElTDZ9Vzc9JjwItjxYgAAAAAAAAAAWfInEWjh0VOQ09ERVJEh49MYXZjIGxpYnZweC12cDlnyKJFo4hEVVJBVElPTkSHlDAwOjAwOjAwLjA0MDAwMDAwMAAAH0O2dcfngQCgwqGggQAAAIJJg0IAABAAFgA4JBwYSgAAICAAEb///4r+AAB1oZ2mm+6BAaWWgkmDQgAAEAAWADgkHBhKAAAgIABIQBxTu2uRu4+zgQC3iveBAfGCAXHwgQM=", t.load();
		});
		if (!t) return "premultiply-alpha-on-upload";
		let n = e.createTexture();
		e.bindTexture(e.TEXTURE_2D, n);
		let r = e.createFramebuffer();
		e.bindFramebuffer(e.FRAMEBUFFER, r), e.framebufferTexture2D(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, n, 0), e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, e.NONE), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, e.RGBA, e.UNSIGNED_BYTE, t);
		let i = new Uint8Array(4);
		return e.readPixels(0, 0, 1, 1, e.RGBA, e.UNSIGNED_BYTE, i), e.deleteFramebuffer(r), e.deleteTexture(n), e.getExtension("WEBGL_lose_context")?.loseContext(), i[0] <= i[3] ? "premultiplied-alpha" : "premultiply-alpha-on-upload";
	})()), oa;
}
var oa, sa = o((() => {
	Y();
})), ca, la, ua = o((() => {
	g(), Kn(), sa(), ln(), ca = class e extends cn {
		constructor(t) {
			super(t), this.isReady = !1, this.uploadMethodId = "video", t = {
				...e.defaultOptions,
				...t
			}, this._autoUpdate = !0, this._isConnectedToTicker = !1, this._updateFPS = t.updateFPS || 0, this._msToNextUpdate = 0, this.autoPlay = t.autoPlay !== !1, this.alphaMode = t.alphaMode ?? "premultiply-alpha-on-upload", this._videoFrameRequestCallback = this._videoFrameRequestCallback.bind(this), this._videoFrameRequestCallbackHandle = null, this._load = null, this._resolve = null, this._reject = null, this._onCanPlay = this._onCanPlay.bind(this), this._onCanPlayThrough = this._onCanPlayThrough.bind(this), this._onError = this._onError.bind(this), this._onPlayStart = this._onPlayStart.bind(this), this._onPlayStop = this._onPlayStop.bind(this), this._onSeeked = this._onSeeked.bind(this), t.autoLoad !== !1 && this.load();
		}
		updateFrame() {
			if (!this.destroyed) {
				if (this._updateFPS) {
					let e = Gn.shared.elapsedMS * this.resource.playbackRate;
					this._msToNextUpdate = Math.floor(this._msToNextUpdate - e);
				}
				(!this._updateFPS || this._msToNextUpdate <= 0) && (this._msToNextUpdate = this._updateFPS ? Math.floor(1e3 / this._updateFPS) : 0), this.isValid && this.update();
			}
		}
		_videoFrameRequestCallback() {
			this.updateFrame(), this.destroyed ? this._videoFrameRequestCallbackHandle = null : this._videoFrameRequestCallbackHandle = this.resource.requestVideoFrameCallback(this._videoFrameRequestCallback);
		}
		get isValid() {
			return !!this.resource.videoWidth && !!this.resource.videoHeight;
		}
		async load() {
			if (this._load) return this._load;
			let e = this.resource, t = this.options;
			return (e.readyState === e.HAVE_ENOUGH_DATA || e.readyState === e.HAVE_FUTURE_DATA) && e.width && e.height && (e.complete = !0), e.addEventListener("play", this._onPlayStart), e.addEventListener("pause", this._onPlayStop), e.addEventListener("seeked", this._onSeeked), this._isSourceReady() ? this._mediaReady() : (t.preload || e.addEventListener("canplay", this._onCanPlay), e.addEventListener("canplaythrough", this._onCanPlayThrough), e.addEventListener("error", this._onError, !0)), this.alphaMode = await aa(), this._load = new Promise((n, r) => {
				this.isValid ? n(this) : (this._resolve = n, this._reject = r, t.preloadTimeoutMs !== void 0 && (this._preloadTimeout = setTimeout(() => {
					this._onError(new ErrorEvent(`Preload exceeded timeout of ${t.preloadTimeoutMs}ms`));
				})), e.load());
			}), this._load;
		}
		_onError(e) {
			this.resource.removeEventListener("error", this._onError, !0), this.emit("error", e), this._reject && (this._reject(e), this._reject = null, this._resolve = null);
		}
		_isSourcePlaying() {
			let e = this.resource;
			return !e.paused && !e.ended;
		}
		_isSourceReady() {
			return this.resource.readyState > 2;
		}
		_onPlayStart() {
			this.isValid || this._mediaReady(), this._configureAutoUpdate();
		}
		_onPlayStop() {
			this._configureAutoUpdate();
		}
		_onSeeked() {
			this._autoUpdate && !this._isSourcePlaying() && (this._msToNextUpdate = 0, this.updateFrame(), this._msToNextUpdate = 0);
		}
		_onCanPlay() {
			this.resource.removeEventListener("canplay", this._onCanPlay), this._mediaReady();
		}
		_onCanPlayThrough() {
			this.resource.removeEventListener("canplaythrough", this._onCanPlay), this._preloadTimeout && (clearTimeout(this._preloadTimeout), this._preloadTimeout = void 0), this._mediaReady();
		}
		_mediaReady() {
			let e = this.resource;
			this.isValid && (this.isReady = !0, this.resize(e.videoWidth, e.videoHeight)), this._msToNextUpdate = 0, this.updateFrame(), this._msToNextUpdate = 0, this._resolve && (this._resolve(this), this._resolve = null, this._reject = null), this._isSourcePlaying() ? this._onPlayStart() : this.autoPlay && this.resource.play();
		}
		destroy() {
			this._configureAutoUpdate();
			let e = this.resource;
			e && (e.removeEventListener("play", this._onPlayStart), e.removeEventListener("pause", this._onPlayStop), e.removeEventListener("seeked", this._onSeeked), e.removeEventListener("canplay", this._onCanPlay), e.removeEventListener("canplaythrough", this._onCanPlayThrough), e.removeEventListener("error", this._onError, !0), e.pause(), e.src = "", e.load()), super.destroy();
		}
		get autoUpdate() {
			return this._autoUpdate;
		}
		set autoUpdate(e) {
			e !== this._autoUpdate && (this._autoUpdate = e, this._configureAutoUpdate());
		}
		get updateFPS() {
			return this._updateFPS;
		}
		set updateFPS(e) {
			e !== this._updateFPS && (this._updateFPS = e, this._configureAutoUpdate());
		}
		_configureAutoUpdate() {
			this._autoUpdate && this._isSourcePlaying() ? !this._updateFPS && this.resource.requestVideoFrameCallback ? (this._isConnectedToTicker && (Gn.shared.remove(this.updateFrame, this), this._isConnectedToTicker = !1, this._msToNextUpdate = 0), this._videoFrameRequestCallbackHandle === null && (this._videoFrameRequestCallbackHandle = this.resource.requestVideoFrameCallback(this._videoFrameRequestCallback))) : (this._videoFrameRequestCallbackHandle !== null && (this.resource.cancelVideoFrameCallback(this._videoFrameRequestCallbackHandle), this._videoFrameRequestCallbackHandle = null), this._isConnectedToTicker || (Gn.shared.add(this.updateFrame, this), this._isConnectedToTicker = !0, this._msToNextUpdate = 0)) : (this._videoFrameRequestCallbackHandle !== null && (this.resource.cancelVideoFrameCallback(this._videoFrameRequestCallbackHandle), this._videoFrameRequestCallbackHandle = null), this._isConnectedToTicker && (Gn.shared.remove(this.updateFrame, this), this._isConnectedToTicker = !1, this._msToNextUpdate = 0));
		}
		static test(e) {
			return globalThis.HTMLVideoElement && e instanceof HTMLVideoElement;
		}
	}, ca.extension = f.TextureSource, ca.defaultOptions = {
		...cn.defaultOptions,
		autoLoad: !0,
		autoPlay: !0,
		updateFPS: 0,
		crossorigin: !0,
		loop: !1,
		muted: !0,
		playsinline: !0,
		preload: !1
	}, ca.MIME_TYPES = {
		ogv: "video/ogg",
		mov: "video/quicktime",
		m4v: "video/mp4"
	}, la = ca;
})), da, fa, pa = o((() => {
	U(), bi(), da = class {
		constructor() {
			this._parsers = [], this._cache = /* @__PURE__ */ new Map(), this._cacheMap = /* @__PURE__ */ new Map();
		}
		reset() {
			this._cacheMap.clear(), this._cache.clear();
		}
		has(e) {
			return this._cache.has(e);
		}
		get(e) {
			let t = this._cache.get(e);
			return t || H(`[Assets] Asset id ${e} was not found in the Cache`), t;
		}
		set(e, t) {
			let n = yi(e), r;
			for (let e = 0; e < this.parsers.length; e++) {
				let i = this.parsers[e];
				if (i.test(t)) {
					r = i.getCacheableAssets(n, t);
					break;
				}
			}
			let i = new Map(Object.entries(r || {}));
			r || n.forEach((e) => {
				i.set(e, t);
			});
			let a = [...i.keys()], o = {
				cacheKeys: a,
				keys: n
			};
			n.forEach((e) => {
				this._cacheMap.set(e, o);
			}), a.forEach((e) => {
				let n = r ? r[e] : t;
				this._cache.has(e) && this._cache.get(e) !== n && H("[Cache] already has key:", e), this._cache.set(e, i.get(e));
			});
		}
		remove(e) {
			if (!this._cacheMap.has(e)) {
				H(`[Assets] Asset id ${e} was not found in the Cache`);
				return;
			}
			let t = this._cacheMap.get(e);
			t.cacheKeys.forEach((e) => {
				this._cache.delete(e);
			}), t.keys.forEach((e) => {
				this._cacheMap.delete(e);
			});
		}
		get parsers() {
			return this._parsers;
		}
	}, fa = new da();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/texture/utils/textureFrom.mjs
function ma(e = {}) {
	let t = e && e.resource, n = t ? e.resource : e, r = t ? e : { resource: e };
	for (let e = 0; e < _a.length; e++) {
		let t = _a[e];
		if (t.test(n)) return new t(r);
	}
	throw Error(`Could not find a source type for resource: ${r.resource}`);
}
function ha(e = {}, t = !1) {
	let n = e && e.resource, r = n ? e.resource : e, i = n ? e : { resource: e };
	if (!t && fa.has(r)) return fa.get(r);
	let a = new K({ source: ma(i) });
	return a.on("destroy", () => {
		fa.has(r) && fa.remove(r);
	}), t || fa.set(r, a), a;
}
function ga(e, t = !1) {
	return typeof e == "string" ? fa.get(e) : e instanceof cn ? new K({ source: e }) : ha(e, t);
}
var _a, va = o((() => {
	pa(), g(), ln(), q(), _a = [], h.handleByList(f.TextureSource, _a), K.from = ga, cn.from = ma;
})), ya = o((() => {
	g(), Xi(), Qi(), ea(), Sn(), na(), ia(), ua(), va(), h.add(Yi, Zi, $i, la, ra, ta, xn);
})), ba, xa = o((() => {
	g(), ba = class {
		constructor(e) {
			this._renderer = e;
		}
		push(e, t, n) {
			this._renderer.renderPipes.batch.break(n), n.add({
				renderPipeId: "filter",
				canBundle: !1,
				action: "pushFilter",
				container: t,
				filterEffect: e
			});
		}
		pop(e, t, n) {
			this._renderer.renderPipes.batch.break(n), n.add({
				renderPipeId: "filter",
				action: "popFilter",
				canBundle: !1
			});
		}
		execute(e) {
			e.action === "pushFilter" ? this._renderer.filter.push(e) : e.action === "popFilter" && this._renderer.filter.pop();
		}
		destroy() {
			this._renderer = null;
		}
	}, ba.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "filter"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/utils/createIdFromString.mjs
function Sa(e, t) {
	let n = wa[e];
	return n === void 0 && (Ca[t] === void 0 && (Ca[t] = 1), wa[e] = n = Ca[t]++), n;
}
var Ca, wa, Ta = o((() => {
	Ca = /* @__PURE__ */ Object.create(null), wa = /* @__PURE__ */ Object.create(null);
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getTestContext.mjs
function Ea() {
	return (!Da || Da?.isContextLost()) && (Da = J.get().createCanvas().getContext("webgl", {})), Da;
}
var Da, Oa = o((() => {
	Y();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getMaxFragmentPrecision.mjs
function ka() {
	if (!Aa) {
		Aa = "mediump";
		let e = Ea();
		e && e.getShaderPrecisionFormat && (Aa = e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.HIGH_FLOAT).precision ? "highp" : "mediump");
	}
	return Aa;
}
var Aa, ja = o((() => {
	Oa();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/addProgramDefines.mjs
function Ma(e, t, n) {
	return t ? e : n ? (e = e.replace("out vec4 finalColor;", ""), `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in varying
        #define finalColor gl_FragColor
        #define texture texture2D
        #endif
        ${e}
        `) : `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in attribute
        #define out varying
        #endif
        ${e}
        `;
}
var Na = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/ensurePrecision.mjs
function Pa(e, t, n) {
	let r = n ? t.maxSupportedFragmentPrecision : t.maxSupportedVertexPrecision;
	if (e.substring(0, 9) !== "precision") {
		let i = n ? t.requestedFragmentPrecision : t.requestedVertexPrecision;
		return i === "highp" && r !== "highp" && (i = "mediump"), `precision ${i} float;
${e}`;
	} else if (r !== "highp" && e.substring(0, 15) === "precision highp") return e.replace("precision highp", "precision mediump");
	return e;
}
var Fa = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/insertVersion.mjs
function Ia(e, t) {
	return t ? `#version 300 es
${e}` : e;
}
var La = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/setProgramName.mjs
function Ra(e, { name: t = "pixi-program" }, n = !0) {
	t = t.replace(/\s+/g, "-"), t += n ? "-fragment" : "-vertex";
	let r = n ? za : Ba;
	return r[t] ? (r[t]++, t += `-${r[t]}`) : r[t] = 1, e.indexOf("#define SHADER_NAME") === -1 ? `${`#define SHADER_NAME ${t}`}
${e}` : e;
}
var za, Ba, Va = o((() => {
	za = {}, Ba = {};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/stripVersion.mjs
function Ha(e, t) {
	return t ? e.replace("#version 300 es", "") : e;
}
var Ua = o((() => {})), Wa, Ga, Ka, qa, Ja = o((() => {
	Ta(), ja(), Na(), Fa(), La(), Va(), Ua(), Wa = {
		stripVersion: Ha,
		ensurePrecision: Pa,
		addProgramDefines: Ma,
		setProgramName: Ra,
		insertVersion: Ia
	}, Ga = /* @__PURE__ */ Object.create(null), Ka = class e {
		constructor(t) {
			t = {
				...e.defaultOptions,
				...t
			};
			let n = t.fragment.indexOf("#version 300 es") !== -1, r = {
				stripVersion: n,
				ensurePrecision: {
					requestedFragmentPrecision: t.preferredFragmentPrecision,
					requestedVertexPrecision: t.preferredVertexPrecision,
					maxSupportedVertexPrecision: "highp",
					maxSupportedFragmentPrecision: ka()
				},
				setProgramName: { name: t.name },
				addProgramDefines: n,
				insertVersion: n
			}, i = t.fragment, a = t.vertex;
			Object.keys(Wa).forEach((e) => {
				let t = r[e];
				i = Wa[e](i, t, !0), a = Wa[e](a, t, !1);
			}), this.fragment = i, this.vertex = a, this.transformFeedbackVaryings = t.transformFeedbackVaryings, this._key = Sa(`${this.vertex}:${this.fragment}`, "gl-program");
		}
		destroy() {
			this.fragment = null, this.vertex = null, this._attributeData = null, this._uniformData = null, this._uniformBlockData = null, this.transformFeedbackVaryings = null, Ga[this._cacheKey] = null;
		}
		static from(t) {
			let n = `${t.vertex}:${t.fragment}`;
			return Ga[n] || (Ga[n] = new e(t), Ga[n]._cacheKey = n), Ga[n];
		}
	}, Ka.defaultOptions = {
		preferredVertexPrecision: "highp",
		preferredFragmentPrecision: "mediump"
	}, qa = Ka;
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/getAttributeInfoFromFormat.mjs
function Ya(e) {
	return Xa[e] ?? Xa.float32;
}
var Xa, Za = o((() => {
	Xa = {
		uint8x2: {
			size: 2,
			stride: 2,
			normalised: !1
		},
		uint8x4: {
			size: 4,
			stride: 4,
			normalised: !1
		},
		sint8x2: {
			size: 2,
			stride: 2,
			normalised: !1
		},
		sint8x4: {
			size: 4,
			stride: 4,
			normalised: !1
		},
		unorm8x2: {
			size: 2,
			stride: 2,
			normalised: !0
		},
		unorm8x4: {
			size: 4,
			stride: 4,
			normalised: !0
		},
		snorm8x2: {
			size: 2,
			stride: 2,
			normalised: !0
		},
		snorm8x4: {
			size: 4,
			stride: 4,
			normalised: !0
		},
		uint16x2: {
			size: 2,
			stride: 4,
			normalised: !1
		},
		uint16x4: {
			size: 4,
			stride: 8,
			normalised: !1
		},
		sint16x2: {
			size: 2,
			stride: 4,
			normalised: !1
		},
		sint16x4: {
			size: 4,
			stride: 8,
			normalised: !1
		},
		unorm16x2: {
			size: 2,
			stride: 4,
			normalised: !0
		},
		unorm16x4: {
			size: 4,
			stride: 8,
			normalised: !0
		},
		snorm16x2: {
			size: 2,
			stride: 4,
			normalised: !0
		},
		snorm16x4: {
			size: 4,
			stride: 8,
			normalised: !0
		},
		float16x2: {
			size: 2,
			stride: 4,
			normalised: !1
		},
		float16x4: {
			size: 4,
			stride: 8,
			normalised: !1
		},
		float32: {
			size: 1,
			stride: 4,
			normalised: !1
		},
		float32x2: {
			size: 2,
			stride: 8,
			normalised: !1
		},
		float32x3: {
			size: 3,
			stride: 12,
			normalised: !1
		},
		float32x4: {
			size: 4,
			stride: 16,
			normalised: !1
		},
		uint32: {
			size: 1,
			stride: 4,
			normalised: !1
		},
		uint32x2: {
			size: 2,
			stride: 8,
			normalised: !1
		},
		uint32x3: {
			size: 3,
			stride: 12,
			normalised: !1
		},
		uint32x4: {
			size: 4,
			stride: 16,
			normalised: !1
		},
		sint32: {
			size: 1,
			stride: 4,
			normalised: !1
		},
		sint32x2: {
			size: 2,
			stride: 8,
			normalised: !1
		},
		sint32x3: {
			size: 3,
			stride: 12,
			normalised: !1
		},
		sint32x4: {
			size: 4,
			stride: 16,
			normalised: !1
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/extractAttributesFromGpuProgram.mjs
function Qa(e, t) {
	let n;
	for (; (n = no.exec(e)) !== null;) {
		let e = to[n[3]] ?? "float32";
		t[n[2]] = {
			location: parseInt(n[1], 10),
			format: e,
			stride: Ya(e).stride,
			offset: 0,
			instance: !1,
			start: 0
		};
	}
	no.lastIndex = 0;
}
function $a(e) {
	return e.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function eo({ source: e, entryPoint: t }) {
	let n = {}, r = $a(e), i = r.indexOf(`fn ${t}(`);
	if (i === -1) return n;
	let a = r.indexOf("->", i);
	if (a === -1) return n;
	let o = r.substring(i, a);
	if (Qa(o, n), Object.keys(n).length === 0) {
		let e = o.match(/\(\s*\w+\s*:\s*(\w+)/);
		if (e) {
			let t = e[1], i = RegExp(`struct\\s+${t}\\s*\\{([^}]+)\\}`, "s"), a = r.match(i);
			a && Qa(a[1], n);
		}
	}
	return n;
}
var to, no, ro = o((() => {
	Za(), to = {
		f32: "float32",
		"vec2<f32>": "float32x2",
		"vec3<f32>": "float32x3",
		"vec4<f32>": "float32x4",
		vec2f: "float32x2",
		vec3f: "float32x3",
		vec4f: "float32x4",
		i32: "sint32",
		"vec2<i32>": "sint32x2",
		"vec3<i32>": "sint32x3",
		"vec4<i32>": "sint32x4",
		vec2i: "sint32x2",
		vec3i: "sint32x3",
		vec4i: "sint32x4",
		u32: "uint32",
		"vec2<u32>": "uint32x2",
		"vec3<u32>": "uint32x3",
		"vec4<u32>": "uint32x4",
		vec2u: "uint32x2",
		vec3u: "uint32x3",
		vec4u: "uint32x4",
		bool: "uint32",
		"vec2<bool>": "uint32x2",
		"vec3<bool>": "uint32x3",
		"vec4<bool>": "uint32x4"
	}, no = /@location\((\d+)\)\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)(?:,|\s|\)|$)/g;
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/extractStructAndGroups.mjs
function io(e) {
	let t = /(^|[^/])@(group|binding)\(\d+\)[^;]+;/g, n = /@group\((\d+)\)/, r = /@binding\((\d+)\)/, i = /var(<[^>]+>)? (\w+)/, a = /:\s*([\w<>]+)/, o = /struct\s+(\w+)\s*{([^}]+)}/g, s = /(\w+)\s*:\s*([\w\<\>]+)/g, c = /struct\s+(\w+)/, l = e.match(t)?.map((e) => ({
		group: parseInt(e.match(n)[1], 10),
		binding: parseInt(e.match(r)[1], 10),
		name: e.match(i)[2],
		isUniform: e.match(i)[1] === "<uniform>",
		type: e.match(a)[1]
	}));
	return l ? {
		groups: l,
		structs: e.match(o)?.map((e) => {
			let t = e.match(c)[1], n = e.match(s).reduce((e, t) => {
				let [n, r] = t.split(":");
				return e[n.trim()] = r.trim(), e;
			}, {});
			return n ? {
				name: t,
				members: n
			} : null;
		}).filter(({ name: e }) => l.some((t) => t.type === e || t.type.includes(`<${e}>`))) ?? []
	} : {
		groups: [],
		structs: []
	};
}
var ao = o((() => {})), oo, so = o((() => {
	oo = /* @__PURE__ */ ((e) => (e[e.VERTEX = 1] = "VERTEX", e[e.FRAGMENT = 2] = "FRAGMENT", e[e.COMPUTE = 4] = "COMPUTE", e))(oo || {});
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/generateGpuLayoutGroups.mjs
function co({ groups: e }) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t[r.group] || (t[r.group] = []), r.isUniform ? t[r.group].push({
			binding: r.binding,
			visibility: oo.VERTEX | oo.FRAGMENT,
			buffer: { type: "uniform" }
		}) : r.type === "sampler" ? t[r.group].push({
			binding: r.binding,
			visibility: oo.FRAGMENT,
			sampler: { type: "filtering" }
		}) : r.type === "texture_2d" || r.type.startsWith("texture_2d<") ? t[r.group].push({
			binding: r.binding,
			visibility: oo.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "2d",
				multisampled: !1
			}
		}) : r.type === "texture_2d_array" || r.type.startsWith("texture_2d_array<") ? t[r.group].push({
			binding: r.binding,
			visibility: oo.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "2d-array",
				multisampled: !1
			}
		}) : (r.type === "texture_cube" || r.type.startsWith("texture_cube<")) && t[r.group].push({
			binding: r.binding,
			visibility: oo.FRAGMENT,
			texture: {
				sampleType: "float",
				viewDimension: "cube",
				multisampled: !1
			}
		});
	}
	for (let e = 0; e < t.length; e++) t[e] || (t[e] = []);
	return t;
}
var lo = o((() => {
	so();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/generateLayoutHash.mjs
function uo({ groups: e }) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		t[r.group] || (t[r.group] = {}), t[r.group][r.name] = r.binding;
	}
	return t;
}
var fo = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/removeStructAndGroupDuplicates.mjs
function po(e, t) {
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
	return {
		structs: [...e.structs, ...t.structs].filter((e) => n.has(e.name) ? !1 : (n.add(e.name), !0)),
		groups: [...e.groups, ...t.groups].filter((e) => {
			let t = `${e.name}-${e.binding}`;
			return r.has(t) ? !1 : (r.add(t), !0);
		})
	};
}
var mo = o((() => {})), ho, go, _o = o((() => {
	Ta(), ro(), ao(), lo(), fo(), mo(), ho = /* @__PURE__ */ Object.create(null), go = class e {
		constructor(e) {
			this._layoutKey = 0, this._attributeLocationsKey = 0;
			let { fragment: t, vertex: n, layout: r, gpuLayout: i, name: a } = e;
			this.name = a, this.fragment = t, this.vertex = n, t.source === n.source ? this.structsAndGroups = io(t.source) : this.structsAndGroups = po(io(n.source), io(t.source)), this.layout = r ?? uo(this.structsAndGroups), this.gpuLayout = i ?? co(this.structsAndGroups), this.autoAssignGlobalUniforms = this.layout[0]?.globalUniforms !== void 0, this.autoAssignLocalUniforms = this.layout[1]?.localUniforms !== void 0, this._generateProgramKey();
		}
		_generateProgramKey() {
			let { vertex: e, fragment: t } = this;
			this._layoutKey = Sa(e.source + t.source + e.entryPoint + t.entryPoint, "program");
		}
		get attributeData() {
			return this._attributeData ?? (this._attributeData = eo(this.vertex)), this._attributeData;
		}
		destroy() {
			this.gpuLayout = null, this.layout = null, this.structsAndGroups = null, this.fragment = null, this.vertex = null, ho[this._cacheKey] = null;
		}
		static from(t) {
			let n = `${t.vertex.source}:${t.fragment.source}:${t.fragment.entryPoint}:${t.vertex.entryPoint}`;
			return ho[n] || (ho[n] = new e(t), ho[n]._cacheKey = n), ho[n];
		}
	};
})), vo, yo = o((() => {
	vo = class {
		constructor(e) {
			this.resources = /* @__PURE__ */ Object.create(null), this._dirty = !0;
			let t = 0;
			for (let n in e) {
				let r = e[n];
				this.setResource(r, t++);
			}
			this._updateKey();
		}
		_updateKey() {
			if (!this._dirty) return;
			this._dirty = !1;
			let e = [], t = 0;
			for (let n in this.resources) e[t++] = this.resources[n]._resourceId;
			this._key = e.join("|");
		}
		setResource(e, t) {
			let n = this.resources[t];
			e !== n && (n?.off?.("change", this.onResourceChange, this), e.on?.("change", this.onResourceChange, this), this.resources[t] = e, this._dirty = !0);
		}
		getResource(e) {
			return this.resources[e];
		}
		_touch(e, t) {
			let n = this.resources;
			for (let r in n) n[r]._gcLastUsed = e, n[r]._touched = t;
		}
		destroy() {
			let e = this.resources;
			for (let t in e) e[t]?.off?.("change", this.onResourceChange, this);
			this.resources = null;
		}
		onResourceChange(e) {
			this._dirty = !0, e.destroyed ? this.destroy() : this._updateKey();
		}
	};
})), bo, xo = o((() => {
	bo = /* @__PURE__ */ ((e) => (e[e.WEBGL = 1] = "WEBGL", e[e.WEBGPU = 2] = "WEBGPU", e[e.CANVAS = 4] = "CANVAS", e[e.BOTH = 3] = "BOTH", e))(bo || {});
})), So, Co, wo = o((() => {
	So = [
		"f32",
		"i32",
		"vec2<f32>",
		"vec3<f32>",
		"vec4<f32>",
		"mat2x2<f32>",
		"mat3x3<f32>",
		"mat4x4<f32>",
		"mat3x2<f32>",
		"mat4x2<f32>",
		"mat2x3<f32>",
		"mat4x3<f32>",
		"mat2x4<f32>",
		"mat3x4<f32>",
		"vec2<i32>",
		"vec3<i32>",
		"vec4<i32>"
	], Co = So.reduce((e, t) => (e[t] = !0, e), {});
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/shader/utils/getDefaultUniformValue.mjs
function To(e, t) {
	switch (e) {
		case "f32": return 0;
		case "vec2<f32>": return new Float32Array(2 * t);
		case "vec3<f32>": return new Float32Array(3 * t);
		case "vec4<f32>": return new Float32Array(4 * t);
		case "mat2x2<f32>": return new Float32Array([
			1,
			0,
			0,
			1
		]);
		case "mat3x3<f32>": return new Float32Array([
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		]);
		case "mat4x4<f32>": return new Float32Array([
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		]);
	}
	return null;
}
var Eo = o((() => {})), Do, Oo, ko = o((() => {
	Ne(), Ta(), wo(), Eo(), Do = class e {
		constructor(t, n) {
			this._touched = 0, this.uid = z("uniform"), this._resourceType = "uniformGroup", this._resourceId = z("resource"), this.isUniformGroup = !0, this._dirtyId = 0, this.destroyed = !1, n = {
				...e.defaultOptions,
				...n
			}, this.uniformStructures = t;
			let r = {};
			for (let e in t) {
				let n = t[e];
				if (n.name = e, n.size = n.size ?? 1, !Co[n.type]) {
					let e = n.type.match(/^array<(\w+(?:<\w+>)?),\s*(\d+)>$/);
					if (e) {
						let [, t, r] = e;
						throw Error(`Uniform type ${n.type} is not supported. Use type: '${t}', size: ${r} instead.`);
					}
					throw Error(`Uniform type ${n.type} is not supported. Supported uniform types are: ${So.join(", ")}`);
				}
				n.value ?? (n.value = To(n.type, n.size)), r[e] = n.value;
			}
			this.uniforms = r, this._dirtyId = 1, this.ubo = n.ubo, this.isStatic = n.isStatic, this._signature = Sa(Object.keys(r).map((e) => `${e}-${t[e].type}`).join("-"), "uniform-group");
		}
		update() {
			this._dirtyId++;
		}
	}, Do.defaultOptions = {
		ubo: !1,
		isStatic: !1
	}, Oo = Do;
})), Ao, jo = o((() => {
	b(), Ne(), Ja(), yo(), _o(), xo(), ko(), Ao = class e extends y {
		constructor(e) {
			super(), this.uid = z("shader"), this._uniformBindMap = /* @__PURE__ */ Object.create(null), this._ownedBindGroups = [], this._destroyed = !1;
			let { gpuProgram: t, glProgram: n, groups: r, resources: i, compatibleRenderers: a, groupMap: o } = e;
			this.gpuProgram = t, this.glProgram = n, a === void 0 && (a = 0, t && (a |= bo.WEBGPU), n && (a |= bo.WEBGL)), this.compatibleRenderers = a;
			let s = {};
			if (!i && !r && (i = {}), i && r) throw Error("[Shader] Cannot have both resources and groups");
			if (!t && r && !o) throw Error("[Shader] No group map or WebGPU shader provided - consider using resources instead.");
			if (!t && r && o) for (let e in o) for (let t in o[e]) {
				let n = o[e][t];
				s[n] = {
					group: e,
					binding: t,
					name: n
				};
			}
			else if (t && r && !o) {
				let e = t.structsAndGroups.groups;
				o = {}, e.forEach((e) => {
					o[e.group] = o[e.group] || {}, o[e.group][e.binding] = e.name, s[e.name] = e;
				});
			} else if (i) {
				r = {}, o = {}, t && t.structsAndGroups.groups.forEach((e) => {
					o[e.group] = o[e.group] || {}, o[e.group][e.binding] = e.name, s[e.name] = e;
				});
				let e = 0;
				for (let t in i) s[t] || (r[99] || (r[99] = new vo(), this._ownedBindGroups.push(r[99])), s[t] = {
					group: 99,
					binding: e,
					name: t
				}, o[99] = o[99] || {}, o[99][e] = t, e++);
				for (let e in i) {
					let t = e, n = i[e];
					!n.source && !n._resourceType && (n = new Oo(n));
					let a = s[t];
					a && (r[a.group] || (r[a.group] = new vo(), this._ownedBindGroups.push(r[a.group])), r[a.group].setResource(n, a.binding));
				}
			}
			this.groups = r, this._uniformBindMap = o, this.resources = this._buildResourceAccessor(r, s);
		}
		addResource(e, t, n) {
			var r, i;
			(r = this._uniformBindMap)[t] || (r[t] = {}), (i = this._uniformBindMap[t])[n] || (i[n] = e), this.groups[t] || (this.groups[t] = new vo(), this._ownedBindGroups.push(this.groups[t]));
		}
		_buildResourceAccessor(e, t) {
			let n = {};
			for (let r in t) {
				let i = t[r];
				Object.defineProperty(n, i.name, {
					get() {
						return e[i.group].getResource(i.binding);
					},
					set(t) {
						e[i.group].setResource(t, i.binding);
					}
				});
			}
			return n;
		}
		destroy(e = !1) {
			this._destroyed || (this._destroyed = !0, this.emit("destroy", this), e && (this.gpuProgram?.destroy(), this.glProgram?.destroy()), this.gpuProgram = null, this.glProgram = null, this.removeAllListeners(), this._uniformBindMap = null, this._ownedBindGroups.forEach((e) => {
				e.destroy();
			}), this._ownedBindGroups = null, this.resources = null, this.groups = null);
		}
		static from(t) {
			let { gpu: n, gl: r, ...i } = t, a, o;
			return n && (a = go.from(n)), r && (o = qa.from(r)), new e({
				gpuProgram: a,
				glProgram: o,
				...i
			});
		}
	};
})), Mo, No, Po, Fo, Io, Lo, Ro, zo, Bo, Vo = o((() => {
	Mo = {
		normal: 0,
		add: 1,
		multiply: 2,
		screen: 3,
		overlay: 4,
		erase: 5,
		"normal-npm": 6,
		"add-npm": 7,
		"screen-npm": 8,
		min: 9,
		max: 10
	}, No = 0, Po = 1, Fo = 2, Io = 3, Lo = 4, Ro = 5, zo = class e {
		constructor() {
			this.data = 0, this.blendMode = "normal", this.polygonOffset = 0, this.blend = !0, this.depthMask = !0;
		}
		get blend() {
			return !!(this.data & 1 << No);
		}
		set blend(e) {
			!!(this.data & 1 << No) !== e && (this.data ^= 1 << No);
		}
		get offsets() {
			return !!(this.data & 1 << Po);
		}
		set offsets(e) {
			!!(this.data & 1 << Po) !== e && (this.data ^= 1 << Po);
		}
		set cullMode(e) {
			if (e === "none") {
				this.culling = !1;
				return;
			}
			this.culling = !0, this.clockwiseFrontFace = e === "front";
		}
		get cullMode() {
			return this.culling ? this.clockwiseFrontFace ? "front" : "back" : "none";
		}
		get culling() {
			return !!(this.data & 1 << Fo);
		}
		set culling(e) {
			!!(this.data & 1 << Fo) !== e && (this.data ^= 1 << Fo);
		}
		get depthTest() {
			return !!(this.data & 1 << Io);
		}
		set depthTest(e) {
			!!(this.data & 1 << Io) !== e && (this.data ^= 1 << Io);
		}
		get depthMask() {
			return !!(this.data & 1 << Ro);
		}
		set depthMask(e) {
			!!(this.data & 1 << Ro) !== e && (this.data ^= 1 << Ro);
		}
		get clockwiseFrontFace() {
			return !!(this.data & 1 << Lo);
		}
		set clockwiseFrontFace(e) {
			!!(this.data & 1 << Lo) !== e && (this.data ^= 1 << Lo);
		}
		get blendMode() {
			return this._blendMode;
		}
		set blendMode(e) {
			this.blend = e !== "none", this._blendMode = e, this._blendModeId = Mo[e] || 0;
		}
		get polygonOffset() {
			return this._polygonOffset;
		}
		set polygonOffset(e) {
			this.offsets = !!e, this._polygonOffset = e;
		}
		toString() {
			return `[pixi.js/core:State blendMode=${this.blendMode} clockwiseFrontFace=${this.clockwiseFrontFace} culling=${this.culling} depthMask=${this.depthMask} polygonOffset=${this.polygonOffset}]`;
		}
		static for2d() {
			let t = new e();
			return t.depthTest = !1, t.blend = !0, t;
		}
	}, zo.default2d = zo.for2d(), Bo = zo;
})), Ho, Uo, Wo = o((() => {
	Ja(), _o(), jo(), Vo(), Ho = class e extends Ao {
		constructor(t) {
			t = {
				...e.defaultOptions,
				...t
			}, super(t), this.enabled = !0, this._state = Bo.for2d(), this.blendMode = t.blendMode, this.padding = t.padding, typeof t.antialias == "boolean" ? this.antialias = t.antialias ? "on" : "off" : this.antialias = t.antialias, this.resolution = t.resolution, this.blendRequired = t.blendRequired, this.clipToViewport = t.clipToViewport, this.addResource("uTexture", 0, 1), t.blendRequired && this.addResource("uBackTexture", 0, 3);
		}
		apply(e, t, n, r) {
			e.applyFilter(this, t, n, r);
		}
		get blendMode() {
			return this._state.blendMode;
		}
		set blendMode(e) {
			this._state.blendMode = e;
		}
		static from(t) {
			let { gpu: n, gl: r, ...i } = t, a, o;
			return n && (a = go.from(n)), r && (o = qa.from(r)), new e({
				gpuProgram: a,
				glProgram: o,
				...i
			});
		}
	}, Ho.defaultOptions = {
		blendMode: "normal",
		resolution: 1,
		padding: 0,
		antialias: "off",
		blendRequired: !1,
		clipToViewport: !0
	}, Uo = Ho;
})), Go, Ko = o((() => {
	Go = "in vec2 aPosition;\nout vec2 vTextureCoord;\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\n\nvec4 filterVertexPosition( void )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n    \n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord( void )\n{\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvoid main(void)\n{\n    gl_Position = filterVertexPosition();\n    vTextureCoord = filterTextureCoord();\n}\n";
})), qo, Jo = o((() => {
	qo = "in vec2 vTextureCoord;\nout vec4 finalColor;\nuniform sampler2D uTexture;\nvoid main() {\n    finalColor = texture(uTexture, vTextureCoord);\n}\n";
})), Yo, Xo = o((() => {
	Yo = "struct GlobalFilterUniforms {\n  uInputSize: vec4<f32>,\n  uInputPixel: vec4<f32>,\n  uInputClamp: vec4<f32>,\n  uOutputFrame: vec4<f32>,\n  uGlobalFrame: vec4<f32>,\n  uOutputTexture: vec4<f32>,\n};\n\n@group(0) @binding(0) var <uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler: sampler;\n\nstruct VSOutput {\n  @builtin(position) position: vec4<f32>,\n  @location(0) uv: vec2<f32>\n};\n\nfn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition: vec2<f32>,\n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n) -> @location(0) vec4<f32> {\n    return textureSample(uTexture, uSampler, uv);\n}\n";
})), Zo, Qo = o((() => {
	Ja(), _o(), Wo(), Ko(), Jo(), Xo(), Zo = class extends Uo {
		constructor() {
			let e = go.from({
				vertex: {
					source: Yo,
					entryPoint: "mainVertex"
				},
				fragment: {
					source: Yo,
					entryPoint: "mainFragment"
				},
				name: "passthrough-filter"
			}), t = qa.from({
				vertex: Go,
				fragment: qo,
				name: "passthrough-filter"
			});
			super({
				gpuProgram: e,
				glProgram: t
			});
		}
	};
})), X, $o = o((() => {
	X = /* @__PURE__ */ ((e) => (e[e.MAP_READ = 1] = "MAP_READ", e[e.MAP_WRITE = 2] = "MAP_WRITE", e[e.COPY_SRC = 4] = "COPY_SRC", e[e.COPY_DST = 8] = "COPY_DST", e[e.INDEX = 16] = "INDEX", e[e.VERTEX = 32] = "VERTEX", e[e.UNIFORM = 64] = "UNIFORM", e[e.STORAGE = 128] = "STORAGE", e[e.INDIRECT = 256] = "INDIRECT", e[e.QUERY_RESOLVE = 512] = "QUERY_RESOLVE", e[e.STATIC = 1024] = "STATIC", e))(X || {});
})), es, ts = o((() => {
	b(), Ne(), $o(), es = class extends y {
		constructor(e) {
			let { data: t, size: n } = e, { usage: r, label: i, shrinkToFit: a } = e;
			super(), this._gpuData = /* @__PURE__ */ Object.create(null), this._gcLastUsed = -1, this.autoGarbageCollect = !0, this.uid = z("buffer"), this._resourceType = "buffer", this._resourceId = z("resource"), this._touched = 0, this._updateID = 1, this._dataInt32 = null, this.shrinkToFit = !0, this.destroyed = !1, t instanceof Array && (t = new Float32Array(t)), this._data = t, n ?? (n = t?.byteLength), this.descriptor = {
				size: n,
				usage: r,
				mappedAtCreation: !!t,
				label: i
			}, this.shrinkToFit = a ?? !0;
		}
		get data() {
			return this._data;
		}
		set data(e) {
			this.setDataWithSize(e, e.length, !0);
		}
		get dataInt32() {
			return this._dataInt32 || (this._dataInt32 = new Int32Array(this.data.buffer)), this._dataInt32;
		}
		get static() {
			return !!(this.descriptor.usage & X.STATIC);
		}
		set static(e) {
			e ? this.descriptor.usage |= X.STATIC : this.descriptor.usage &= ~X.STATIC;
		}
		setDataWithSize(e, t, n) {
			if (this._updateID++, this._updateSize = t * e.BYTES_PER_ELEMENT, this._data === e) {
				n && this.emit("update", this);
				return;
			}
			let r = this._data;
			if (this._data = e, this._dataInt32 = null, !r || r.length !== e.length) {
				!this.shrinkToFit && r && e.byteLength < r.byteLength ? n && this.emit("update", this) : (this.descriptor.size = e.byteLength, this._resourceId = z("resource"), this.emit("change", this));
				return;
			}
			n && this.emit("update", this);
		}
		update(e) {
			this._updateSize = e ?? this._updateSize, this._updateID++, this.emit("update", this);
		}
		unload() {
			this.emit("unload", this);
			for (let e in this._gpuData) this._gpuData[e]?.destroy();
			this._gpuData = /* @__PURE__ */ Object.create(null);
		}
		destroy() {
			this.destroyed = !0, this.unload(), this.emit("destroy", this), this.emit("change", this), this._data = null, this.descriptor = null, this.removeAllListeners();
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/ensureIsBuffer.mjs
function ns(e, t) {
	if (!(e instanceof es)) {
		let n = t ? X.INDEX : X.VERTEX;
		e instanceof Array && (t ? (e = new Uint32Array(e), n = X.INDEX | X.COPY_DST) : (e = new Float32Array(e), n = X.VERTEX | X.COPY_DST)), e = new es({
			data: e,
			label: t ? "index-mesh-buffer" : "vertex-mesh-buffer",
			usage: n
		});
	}
	return e;
}
var rs = o((() => {
	ts(), $o();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/getGeometryBounds.mjs
function is(e, t, n) {
	let r = e.getAttribute(t);
	if (!r) return n.minX = 0, n.minY = 0, n.maxX = 0, n.maxY = 0, n;
	let i = r.buffer.data, a = Infinity, o = Infinity, s = -Infinity, c = -Infinity, l = i.BYTES_PER_ELEMENT, u = (r.offset || 0) / l, d = (r.stride || 8) / l;
	for (let e = u; e < i.length; e += d) {
		let t = i[e], n = i[e + 1];
		t > s && (s = t), n > c && (c = n), t < a && (a = t), n < o && (o = n);
	}
	return n.minX = a, n.minY = o, n.maxX = s, n.maxY = c, n;
}
var as = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/Geometry.mjs
function os(e) {
	return (e instanceof es || Array.isArray(e) || e.BYTES_PER_ELEMENT) && (e = { buffer: e }), e.buffer = ns(e.buffer, !1), e;
}
var ss, cs = o((() => {
	b(), mt(), Ne(), ts(), rs(), as(), ss = class extends y {
		constructor(e = {}) {
			super(), this._gpuData = /* @__PURE__ */ Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this.uid = z("geometry"), this._layoutKey = 0, this.instanceCount = 1, this._bounds = new pt(), this._boundsDirty = !0;
			let { attributes: t, indexBuffer: n, topology: r } = e;
			if (this.buffers = [], this.attributes = {}, t) for (let e in t) this.addAttribute(e, t[e]);
			this.instanceCount = e.instanceCount ?? 1, n && this.addIndex(n), this.topology = r || "triangle-list";
		}
		onBufferUpdate() {
			this._boundsDirty = !0, this.emit("update", this);
		}
		getAttribute(e) {
			return this.attributes[e];
		}
		getIndex() {
			return this.indexBuffer;
		}
		getBuffer(e) {
			return this.getAttribute(e).buffer;
		}
		getSize() {
			for (let e in this.attributes) {
				let t = this.attributes[e];
				return t.buffer.data.length / (t.stride / 4 || t.size);
			}
			return 0;
		}
		addAttribute(e, t) {
			let n = os(t);
			this.buffers.indexOf(n.buffer) === -1 && (this.buffers.push(n.buffer), n.buffer.on("update", this.onBufferUpdate, this), n.buffer.on("change", this.onBufferUpdate, this)), this.attributes[e] = n;
		}
		addIndex(e) {
			this.indexBuffer = ns(e, !0), this.buffers.push(this.indexBuffer);
		}
		get bounds() {
			return this._boundsDirty ? (this._boundsDirty = !1, is(this, "aPosition", this._bounds)) : this._bounds;
		}
		unload() {
			this.emit("unload", this);
			for (let e in this._gpuData) this._gpuData[e]?.destroy();
			this._gpuData = /* @__PURE__ */ Object.create(null);
		}
		destroy(e = !1) {
			this.emit("destroy", this), this.removeAllListeners(), e && this.buffers.forEach((e) => e.destroy()), this.unload(), this.indexBuffer?.destroy(), this.attributes = null, this.buffers = null, this.indexBuffer = null, this._bounds = null;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/maths/misc/squaredDistanceToLineSegment.mjs
function ls(e, t, n, r, i, a) {
	let o = e - n, s = t - r, c = i - n, l = a - r, u = o * c + s * l, d = c * c + l * l, f = -1;
	d !== 0 && (f = u / d);
	let p, m;
	f < 0 ? (p = n, m = r) : f > 1 ? (p = i, m = a) : (p = n + f * c, m = r + f * l);
	let h = e - p, g = t - m;
	return h * h + g * g;
}
var us = o((() => {})), ds, fs = o((() => {
	dt(), ds = class e {
		constructor(e = 0, t = 0, n = 0) {
			this.type = "circle", this.x = e, this.y = t, this.radius = n;
		}
		clone() {
			return new e(this.x, this.y, this.radius);
		}
		contains(e, t) {
			if (this.radius <= 0) return !1;
			let n = this.radius * this.radius, r = this.x - e, i = this.y - t;
			return r *= r, i *= i, r + i <= n;
		}
		strokeContains(e, t, n, r = .5) {
			if (this.radius === 0) return !1;
			let i = this.x - e, a = this.y - t, o = this.radius, s = (1 - r) * n, c = Math.sqrt(i * i + a * a);
			return c <= o + s && c > o - (n - s);
		}
		getBounds(e) {
			return e || (e = new W()), e.x = this.x - this.radius, e.y = this.y - this.radius, e.width = this.radius * 2, e.height = this.radius * 2, e;
		}
		copyFrom(e) {
			return this.x = e.x, this.y = e.y, this.radius = e.radius, this;
		}
		copyTo(e) {
			return e.copyFrom(this), e;
		}
		toString() {
			return `[pixi.js/math:Circle x=${this.x} y=${this.y} radius=${this.radius}]`;
		}
	};
})), ps, ms = o((() => {
	dt(), ps = class e {
		constructor(e = 0, t = 0, n = 0, r = 0) {
			this.type = "ellipse", this.x = e, this.y = t, this.halfWidth = n, this.halfHeight = r;
		}
		clone() {
			return new e(this.x, this.y, this.halfWidth, this.halfHeight);
		}
		contains(e, t) {
			if (this.halfWidth <= 0 || this.halfHeight <= 0) return !1;
			let n = (e - this.x) / this.halfWidth, r = (t - this.y) / this.halfHeight;
			return n *= n, r *= r, n + r <= 1;
		}
		strokeContains(e, t, n, r = .5) {
			let { halfWidth: i, halfHeight: a } = this;
			if (i <= 0 || a <= 0) return !1;
			let o = n * (1 - r), s = n - o, c = i - s, l = a - s, u = i + o, d = a + o, f = e - this.x, p = t - this.y, m = f * f / (c * c) + p * p / (l * l), h = f * f / (u * u) + p * p / (d * d);
			return m > 1 && h <= 1;
		}
		getBounds(e) {
			return e || (e = new W()), e.x = this.x - this.halfWidth, e.y = this.y - this.halfHeight, e.width = this.halfWidth * 2, e.height = this.halfHeight * 2, e;
		}
		copyFrom(e) {
			return this.x = e.x, this.y = e.y, this.halfWidth = e.halfWidth, this.halfHeight = e.halfHeight, this;
		}
		copyTo(e) {
			return e.copyFrom(this), e;
		}
		toString() {
			return `[pixi.js/math:Ellipse x=${this.x} y=${this.y} halfWidth=${this.halfWidth} halfHeight=${this.halfHeight}]`;
		}
	};
})), hs, gs, _s, vs = o((() => {
	Le(), us(), dt(), _s = class e {
		constructor(...e) {
			this.type = "polygon";
			let t = Array.isArray(e[0]) ? e[0] : e;
			if (typeof t[0] != "number") {
				let e = [];
				for (let n = 0, r = t.length; n < r; n++) e.push(t[n].x, t[n].y);
				t = e;
			}
			this.points = t, this.closePath = !0;
		}
		isClockwise() {
			let e = 0, t = this.points, n = t.length;
			for (let r = 0; r < n; r += 2) {
				let i = t[r], a = t[r + 1], o = t[(r + 2) % n], s = t[(r + 3) % n];
				e += (o - i) * (s + a);
			}
			return e < 0;
		}
		containsPolygon(e) {
			let t = this.getBounds(hs), n = e.getBounds(gs);
			if (!t.containsRect(n)) return !1;
			let r = e.points;
			for (let e = 0; e < r.length; e += 2) {
				let t = r[e], n = r[e + 1];
				if (!this.contains(t, n)) return !1;
			}
			return !0;
		}
		clone() {
			let t = new e(this.points.slice());
			return t.closePath = this.closePath, t;
		}
		contains(e, t) {
			let n = !1, r = this.points.length / 2;
			for (let i = 0, a = r - 1; i < r; a = i++) {
				let r = this.points[i * 2], o = this.points[i * 2 + 1], s = this.points[a * 2], c = this.points[a * 2 + 1];
				o > t != c > t && e < (s - r) * ((t - o) / (c - o)) + r && (n = !n);
			}
			return n;
		}
		strokeContains(e, t, n, r = .5) {
			let i = n * n, a = i * (1 - r), o = i - a, { points: s } = this, c = s.length - (this.closePath ? 0 : 2);
			for (let n = 0; n < c; n += 2) {
				let r = s[n], i = s[n + 1], c = s[(n + 2) % s.length], l = s[(n + 3) % s.length];
				if (ls(e, t, r, i, c, l) <= (Math.sign((c - r) * (t - i) - (l - i) * (e - r)) < 0 ? o : a)) return !0;
			}
			return !1;
		}
		getBounds(e) {
			e || (e = new W());
			let t = this.points, n = Infinity, r = -Infinity, i = Infinity, a = -Infinity;
			for (let e = 0, o = t.length; e < o; e += 2) {
				let o = t[e], s = t[e + 1];
				n = o < n ? o : n, r = o > r ? o : r, i = s < i ? s : i, a = s > a ? s : a;
			}
			return e.x = n, e.width = r - n, e.y = i, e.height = a - i, e;
		}
		copyFrom(e) {
			return this.points = e.points.slice(), this.closePath = e.closePath, this;
		}
		copyTo(e) {
			return e.copyFrom(this), e;
		}
		toString() {
			return `[pixi.js/math:PolygoncloseStroke=${this.closePath}points=${this.points.reduce((e, t) => `${e}, ${t}`, "")}]`;
		}
		get lastX() {
			return this.points[this.points.length - 2];
		}
		get lastY() {
			return this.points[this.points.length - 1];
		}
		get x() {
			return V("8.11.0", "Polygon.lastX is deprecated, please use Polygon.lastX instead."), this.points[this.points.length - 2];
		}
		get y() {
			return V("8.11.0", "Polygon.y is deprecated, please use Polygon.lastY instead."), this.points[this.points.length - 1];
		}
		get startX() {
			return this.points[0];
		}
		get startY() {
			return this.points[1];
		}
	};
})), ys, bs, xs = o((() => {
	dt(), ys = (e, t, n, r, i, a, o) => {
		let s = e - n, c = t - r, l = Math.sqrt(s * s + c * c);
		return l >= i - a && l <= i + o;
	}, bs = class e {
		constructor(e = 0, t = 0, n = 0, r = 0, i = 20) {
			this.type = "roundedRectangle", this.x = e, this.y = t, this.width = n, this.height = r, this.radius = i;
		}
		getBounds(e) {
			return e || (e = new W()), e.x = this.x, e.y = this.y, e.width = this.width, e.height = this.height, e;
		}
		clone() {
			return new e(this.x, this.y, this.width, this.height, this.radius);
		}
		copyFrom(e) {
			return this.x = e.x, this.y = e.y, this.width = e.width, this.height = e.height, this;
		}
		copyTo(e) {
			return e.copyFrom(this), e;
		}
		contains(e, t) {
			if (this.width <= 0 || this.height <= 0) return !1;
			if (e >= this.x && e <= this.x + this.width && t >= this.y && t <= this.y + this.height) {
				let n = Math.max(0, Math.min(this.radius, Math.min(this.width, this.height) / 2));
				if (t >= this.y + n && t <= this.y + this.height - n || e >= this.x + n && e <= this.x + this.width - n) return !0;
				let r = e - (this.x + n), i = t - (this.y + n), a = n * n;
				if (r * r + i * i <= a || (r = e - (this.x + this.width - n), r * r + i * i <= a) || (i = t - (this.y + this.height - n), r * r + i * i <= a) || (r = e - (this.x + n), r * r + i * i <= a)) return !0;
			}
			return !1;
		}
		strokeContains(e, t, n, r = .5) {
			let { x: i, y: a, width: o, height: s, radius: c } = this, l = n * (1 - r), u = n - l, d = i + c, f = a + c, p = o - c * 2, m = s - c * 2, h = i + o, g = a + s;
			return (e >= i - l && e <= i + u || e >= h - u && e <= h + l) && t >= f && t <= f + m || (t >= a - l && t <= a + u || t >= g - u && t <= g + l) && e >= d && e <= d + p ? !0 : e < d && t < f && ys(e, t, d, f, c, u, l) || e > h - c && t < f && ys(e, t, h - c, f, c, u, l) || e > h - c && t > g - c && ys(e, t, h - c, g - c, c, u, l) || e < d && t > g - c && ys(e, t, d, g - c, c, u, l);
		}
		toString() {
			return `[pixi.js/math:RoundedRectangle x=${this.x} y=${this.y}width=${this.width} height=${this.height} radius=${this.radius}]`;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/bounds/getRenderableBounds.mjs
function Ss(e, t) {
	t.clear();
	let n = t.matrix;
	for (let n = 0; n < e.length; n++) {
		let r = e[n];
		if (r.globalDisplayStatus < 7) continue;
		let i = r.renderGroup ?? r.parentRenderGroup;
		i?.isCachedAsTexture ? t.matrix = Cs.copyFrom(i.textureOffsetInverseTransform).append(r.worldTransform) : i?._parentCacheAsTextureRenderGroup ? t.matrix = Cs.copyFrom(i._parentCacheAsTextureRenderGroup.inverseWorldTransform).append(r.groupTransform) : t.matrix = r.worldTransform, t.addBounds(r.bounds);
	}
	return t.matrix = n, t;
}
var Cs, ws = o((() => {
	R(), Cs = new L();
})), Ts, Es, Ds, Os = o((() => {
	g(), Qo(), R(), yo(), cs(), ko(), q(), kn(), xo(), mt(), ws(), U(), Ts = new ss({
		attributes: { aPosition: {
			buffer: new Float32Array([
				0,
				0,
				1,
				0,
				1,
				1,
				0,
				1
			]),
			format: "float32x2",
			stride: 8,
			offset: 0
		} },
		indexBuffer: new Uint32Array([
			0,
			1,
			2,
			0,
			2,
			3
		])
	}), Es = class {
		constructor() {
			this.skip = !1, this.inputTexture = null, this.backTexture = null, this.filters = null, this.bounds = new pt(), this.container = null, this.blendRequired = !1, this.outputRenderSurface = null, this.globalFrame = {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			}, this.firstEnabledIndex = -1, this.lastEnabledIndex = -1;
		}
	}, Ds = class {
		constructor(e) {
			this._filterStackIndex = 0, this._filterStack = [], this._filterGlobalUniforms = new Oo({
				uInputSize: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uInputPixel: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uInputClamp: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uOutputFrame: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uGlobalFrame: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uOutputTexture: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				}
			}), this._globalFilterBindGroup = new vo({}), this.renderer = e;
		}
		get activeBackTexture() {
			return this._activeFilterData?.backTexture;
		}
		push(e) {
			let t = this.renderer, n = e.filterEffect.filters, r = this._pushFilterData();
			r.skip = !1, r.filters = n, r.container = e.container, r.outputRenderSurface = t.renderTarget.renderSurface;
			let i = t.renderTarget.renderTarget.colorTexture.source, a = i.resolution, o = i.antialias;
			if (n.every((e) => !e.enabled)) {
				r.skip = !0;
				return;
			}
			let s = r.bounds;
			if (this._calculateFilterArea(e, s), this._calculateFilterBounds(r, t.renderTarget.rootViewPort, o, a, 1), r.skip) return;
			let c = this._getPreviousFilterData(), l = this._findFilterResolution(a), u = 0, d = 0;
			c && (u = c.bounds.minX, d = c.bounds.minY), this._calculateGlobalFrame(r, u, d, l, i.width, i.height), this._setupFilterTextures(r, s, t, c);
		}
		generateFilteredTexture({ texture: e, filters: t }) {
			let n = this._pushFilterData();
			this._activeFilterData = n, n.skip = !1, n.filters = t;
			let r = e.source, i = r.resolution, a = r.antialias;
			if (t.every((e) => !e.enabled)) return n.skip = !0, e;
			let o = n.bounds;
			if (o.addRect(e.frame), this._calculateFilterBounds(n, o.rectangle, a, i, 0), n.skip) return e;
			let s = i;
			this._calculateGlobalFrame(n, 0, 0, s, r.width, r.height), n.outputRenderSurface = On.getOptimalTexture(o.width, o.height, n.resolution, n.antialias), n.backTexture = K.EMPTY, n.inputTexture = e, this.renderer.renderTarget.finishRenderPass(), this._applyFiltersToTexture(n, !0);
			let c = n.outputRenderSurface;
			return c.source.alphaMode = "premultiplied-alpha", c;
		}
		pop() {
			let e = this.renderer, t = this._popFilterData();
			t.skip || (e.globalUniforms.pop(), e.renderTarget.finishRenderPass(), this._activeFilterData = t, this._applyFiltersToTexture(t, !1), t.blendRequired && On.returnTexture(t.backTexture), On.returnTexture(t.inputTexture));
		}
		getBackTexture(e, t, n) {
			let r = e.colorTexture.source._resolution, i = On.getOptimalTexture(t.width, t.height, r, !1), a = t.minX, o = t.minY;
			n && (a -= n.minX, o -= n.minY), a = Math.floor(a * r), o = Math.floor(o * r);
			let s = Math.ceil(t.width * r), c = Math.ceil(t.height * r);
			return this.renderer.renderTarget.copyToTexture(e, i, {
				x: a,
				y: o
			}, {
				width: s,
				height: c
			}, {
				x: 0,
				y: 0
			}), i;
		}
		applyFilter(e, t, n, r) {
			let i = this.renderer, a = this._activeFilterData, o = a.outputRenderSurface === n, s = i.renderTarget.rootRenderTarget.colorTexture.source._resolution, c = this._findFilterResolution(s), l = 0, u = 0;
			if (o) {
				let e = this._findPreviousFilterOffset();
				l = e.x, u = e.y;
			}
			this._updateFilterUniforms(t, n, a, l, u, c, o, r);
			let d = e.enabled ? e : this._getPassthroughFilter();
			this._setupBindGroupsAndRender(d, t, i);
		}
		calculateSpriteMatrix(e, t) {
			let n = this._activeFilterData, r = e.set(n.inputTexture._source.width, 0, 0, n.inputTexture._source.height, n.bounds.minX, n.bounds.minY), i = t.worldTransform.copyTo(L.shared), a = t.renderGroup || t.parentRenderGroup;
			return a && a.cacheToLocalTransform && i.prepend(a.cacheToLocalTransform), i.invert(), r.prepend(i), r.scale(1 / t.texture.orig.width, 1 / t.texture.orig.height), r.translate(t.anchor.x, t.anchor.y), r;
		}
		destroy() {
			this._passthroughFilter?.destroy(!0), this._passthroughFilter = null;
		}
		_getPassthroughFilter() {
			return this._passthroughFilter ?? (this._passthroughFilter = new Zo()), this._passthroughFilter;
		}
		_setupBindGroupsAndRender(e, t, n) {
			if (n.renderPipes.uniformBatch) {
				let e = n.renderPipes.uniformBatch.getUboResource(this._filterGlobalUniforms);
				this._globalFilterBindGroup.setResource(e, 0);
			} else this._globalFilterBindGroup.setResource(this._filterGlobalUniforms, 0);
			this._globalFilterBindGroup.setResource(t.source, 1), this._globalFilterBindGroup.setResource(t.source.style, 2), e.groups[0] = this._globalFilterBindGroup, n.encoder.draw({
				geometry: Ts,
				shader: e,
				state: e._state,
				topology: "triangle-list"
			}), n.type === bo.WEBGL && n.renderTarget.finishRenderPass();
		}
		_setupFilterTextures(e, t, n, r) {
			if (e.backTexture = K.EMPTY, e.inputTexture = On.getOptimalTexture(t.width, t.height, e.resolution, e.antialias), e.blendRequired) {
				n.renderTarget.finishRenderPass();
				let i = n.renderTarget.getRenderTarget(e.outputRenderSurface);
				e.backTexture = this.getBackTexture(i, t, r?.bounds);
			}
			n.renderTarget.bind(e.inputTexture, !0), n.globalUniforms.push({ offset: t });
		}
		_calculateGlobalFrame(e, t, n, r, i, a) {
			let o = e.globalFrame;
			o.x = t * r, o.y = n * r, o.width = i * r, o.height = a * r;
		}
		_updateFilterUniforms(e, t, n, r, i, a, o, s) {
			let c = this._filterGlobalUniforms.uniforms, l = c.uOutputFrame, u = c.uInputSize, d = c.uInputPixel, f = c.uInputClamp, p = c.uGlobalFrame, m = c.uOutputTexture;
			o ? (l[0] = n.bounds.minX - r, l[1] = n.bounds.minY - i) : (l[0] = 0, l[1] = 0), l[2] = e.frame.width, l[3] = e.frame.height, u[0] = e.source.width, u[1] = e.source.height, u[2] = 1 / u[0], u[3] = 1 / u[1], d[0] = e.source.pixelWidth, d[1] = e.source.pixelHeight, d[2] = 1 / d[0], d[3] = 1 / d[1], f[0] = .5 * d[2], f[1] = .5 * d[3], f[2] = e.frame.width * u[2] - .5 * d[2], f[3] = e.frame.height * u[3] - .5 * d[3];
			let h = this.renderer.renderTarget.rootRenderTarget.colorTexture;
			p[0] = r * a, p[1] = i * a, p[2] = h.source.width * a, p[3] = h.source.height * a, t instanceof K && (t.source.resource = null);
			let g = this.renderer.renderTarget.getRenderTarget(t);
			this.renderer.renderTarget.bind(t, !!s), t instanceof K ? (m[0] = t.frame.width, m[1] = t.frame.height) : (m[0] = g.width, m[1] = g.height), m[2] = g.isRoot ? -1 : 1, this._filterGlobalUniforms.update();
		}
		_findFilterResolution(e) {
			let t = this._filterStackIndex - 1;
			for (; t > 0 && this._filterStack[t].skip;) --t;
			return t > 0 && this._filterStack[t].inputTexture ? this._filterStack[t].inputTexture.source._resolution : e;
		}
		_findPreviousFilterOffset() {
			let e = 0, t = 0, n = this._filterStackIndex;
			for (; n > 0;) {
				n--;
				let r = this._filterStack[n];
				if (!r.skip) {
					e = r.bounds.minX, t = r.bounds.minY;
					break;
				}
			}
			return {
				x: e,
				y: t
			};
		}
		_calculateFilterArea(e, t) {
			if (e.renderables ? Ss(e.renderables, t) : e.filterEffect.filterArea ? (t.clear(), t.addRect(e.filterEffect.filterArea), t.applyMatrix(e.container.worldTransform)) : e.container.getFastGlobalBounds(!0, t), e.container) {
				let n = (e.container.renderGroup || e.container.parentRenderGroup).cacheToLocalTransform;
				n && t.applyMatrix(n);
			}
		}
		_applyFiltersToTexture(e, t) {
			let n = e.inputTexture, r = e.bounds, i = e.filters, a = e.firstEnabledIndex, o = e.lastEnabledIndex;
			if (this._globalFilterBindGroup.setResource(n.source.style, 2), this._globalFilterBindGroup.setResource(e.backTexture.source, 3), a === o) i[a].apply(this, n, e.outputRenderSurface, t);
			else {
				let n = e.inputTexture, s = On.getOptimalTexture(r.width, r.height, n.source._resolution, !1), c = s;
				for (let e = a; e < o; e++) {
					let t = i[e];
					if (!t.enabled) continue;
					t.apply(this, n, c, !0);
					let r = n;
					n = c, c = r;
				}
				i[o].apply(this, n, e.outputRenderSurface, t), On.returnTexture(s);
			}
		}
		_calculateFilterBounds(e, t, n, r, i) {
			let a = this.renderer, o = e.bounds, s = e.filters, c = Infinity, l = 0, u = !0, d = !1, f = !1, p = !0, m = -1, h = -1;
			for (let e = 0; e < s.length; e++) {
				let t = s[e];
				if (t.enabled) {
					if (m === -1 && (m = e), h = e, c = Math.min(c, t.resolution === "inherit" ? r : t.resolution), l += t.padding, t.antialias === "off" ? u = !1 : t.antialias === "inherit" && u && (u = n), t.clipToViewport || (p = !1), !(t.compatibleRenderers & a.type)) {
						f = !1;
						break;
					}
					if (t.blendRequired && !(a.backBuffer?.useBackBuffer ?? !0)) {
						H("Blend filter requires backBuffer on WebGL renderer to be enabled. Set `useBackBuffer: true` in the renderer options."), f = !1;
						break;
					}
					f = !0, d || (d = t.blendRequired);
				}
			}
			if (!f) {
				e.skip = !0;
				return;
			}
			if (p && o.fitBounds(0, t.width / r, 0, t.height / r), o.scale(c).ceil().scale(1 / c).pad((l | 0) * i), !o.isPositive) {
				e.skip = !0;
				return;
			}
			e.antialias = u, e.resolution = c, e.blendRequired = d, e.firstEnabledIndex = m, e.lastEnabledIndex = h;
		}
		_popFilterData() {
			return this._filterStackIndex--, this._filterStack[this._filterStackIndex];
		}
		_getPreviousFilterData() {
			let e, t = this._filterStackIndex - 1;
			for (; t > 0 && (t--, e = this._filterStack[t], e.skip););
			return e;
		}
		_pushFilterData() {
			let e = this._filterStack[this._filterStackIndex];
			return e || (e = this._filterStack[this._filterStackIndex] = new Es()), this._filterStackIndex++, e;
		}
	}, Ds.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "filter"
	};
})), ks = o((() => {
	g(), xa(), Os(), h.add(Ds), h.add(ba);
})), As = /* @__PURE__ */ c({}), js = o((() => {
	Nr(), Rr(), oi(), Ri(), ya(), ks();
})), Ms, Ns = o((() => {
	g(), Ms = {
		extension: {
			type: f.Environment,
			name: "browser",
			priority: -1
		},
		test: () => !0,
		load: async () => {
			await Promise.resolve().then(() => (js(), As));
		}
	};
})), Ps = /* @__PURE__ */ c({}), Fs = o((() => {
	Ri(), ya(), ks();
})), Is, Ls = o((() => {
	g(), Is = {
		extension: {
			type: f.Environment,
			name: "webworker",
			priority: 0
		},
		test: () => typeof self < "u" && self.WorkerGlobalScope !== void 0,
		load: async () => {
			await Promise.resolve().then(() => (Fs(), Ps));
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/environment/autoDetectEnvironment.mjs
async function Rs(e) {
	if (!e) for (let e = 0; e < zs.length; e++) {
		let t = zs[e];
		if (t.value.test()) {
			await t.value.load();
			return;
		}
	}
}
var zs, Bs = o((() => {
	g(), zs = [], h.handleByNamedList(f.Environment, zs);
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/browser/unsafeEvalSupported.mjs
function Vs() {
	if (typeof Hs == "boolean") return Hs;
	try {
		Hs = Function("param1", "param2", "param3", "return param1[param2] === param3;")({ a: "b" }, "a", "b") === !0;
	} catch {
		Hs = !1;
	}
	return Hs;
}
var Hs, Us = o((() => {}));
//#endregion
//#region node_modules/earcut/src/earcut.js
function Ws(e, t, n = 2) {
	let r = t && t.length, i = r ? t[0] * n : e.length, a = Gs(e, 0, i, n, !0), o = [];
	if (!a || a.next === a.prev) return o;
	let s, c, l;
	if (r && (a = Qs(e, t, a, n)), e.length > 80 * n) {
		s = e[0], c = e[1];
		let t = s, r = c;
		for (let a = n; a < i; a += n) {
			let n = e[a], i = e[a + 1];
			n < s && (s = n), i < c && (c = i), n > t && (t = n), i > r && (r = i);
		}
		l = Math.max(t - s, r - c), l = l === 0 ? 0 : 32767 / l;
	}
	return qs(a, o, n, s, c, l, 0), o;
}
function Gs(e, t, n, r, i) {
	let a;
	if (i === Sc(e, t, n, r) > 0) for (let i = t; i < n; i += r) a = yc(i / r | 0, e[i], e[i + 1], a);
	else for (let i = n - r; i >= t; i -= r) a = yc(i / r | 0, e[i], e[i + 1], a);
	return a && dc(a, a.next) && (bc(a), a = a.next), a;
}
function Ks(e, t) {
	if (!e) return e;
	t || (t = e);
	let n = e, r;
	do
		if (r = !1, !n.steiner && (dc(n, n.next) || uc(n.prev, n, n.next) === 0)) {
			if (bc(n), n = t = n.prev, n === n.next) break;
			r = !0;
		} else n = n.next;
	while (r || n !== t);
	return t;
}
function qs(e, t, n, r, i, a, o) {
	if (!e) return;
	!o && a && rc(e, r, i, a);
	let s = e;
	for (; e.prev !== e.next;) {
		let c = e.prev, l = e.next;
		if (a ? Ys(e, r, i, a) : Js(e)) {
			t.push(c.i, e.i, l.i), bc(e), e = l.next, s = l.next;
			continue;
		}
		if (e = l, e === s) {
			o ? o === 1 ? (e = Xs(Ks(e), t), qs(e, t, n, r, i, a, 2)) : o === 2 && Zs(e, t, n, r, i, a) : qs(Ks(e), t, n, r, i, a, 1);
			break;
		}
	}
}
function Js(e) {
	let t = e.prev, n = e, r = e.next;
	if (uc(t, n, r) >= 0) return !1;
	let i = t.x, a = n.x, o = r.x, s = t.y, c = n.y, l = r.y, u = Math.min(i, a, o), d = Math.min(s, c, l), f = Math.max(i, a, o), p = Math.max(s, c, l), m = r.next;
	for (; m !== t;) {
		if (m.x >= u && m.x <= f && m.y >= d && m.y <= p && cc(i, s, a, c, o, l, m.x, m.y) && uc(m.prev, m, m.next) >= 0) return !1;
		m = m.next;
	}
	return !0;
}
function Ys(e, t, n, r) {
	let i = e.prev, a = e, o = e.next;
	if (uc(i, a, o) >= 0) return !1;
	let s = i.x, c = a.x, l = o.x, u = i.y, d = a.y, f = o.y, p = Math.min(s, c, l), m = Math.min(u, d, f), h = Math.max(s, c, l), g = Math.max(u, d, f), _ = ac(p, m, t, n, r), v = ac(h, g, t, n, r), y = e.prevZ, b = e.nextZ;
	for (; y && y.z >= _ && b && b.z <= v;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && cc(s, u, c, d, l, f, y.x, y.y) && uc(y.prev, y, y.next) >= 0 || (y = y.prevZ, b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && cc(s, u, c, d, l, f, b.x, b.y) && uc(b.prev, b, b.next) >= 0)) return !1;
		b = b.nextZ;
	}
	for (; y && y.z >= _;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && cc(s, u, c, d, l, f, y.x, y.y) && uc(y.prev, y, y.next) >= 0) return !1;
		y = y.prevZ;
	}
	for (; b && b.z <= v;) {
		if (b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && cc(s, u, c, d, l, f, b.x, b.y) && uc(b.prev, b, b.next) >= 0) return !1;
		b = b.nextZ;
	}
	return !0;
}
function Xs(e, t) {
	let n = e;
	do {
		let r = n.prev, i = n.next.next;
		!dc(r, i) && fc(r, n, n.next, i) && gc(r, i) && gc(i, r) && (t.push(r.i, n.i, i.i), bc(n), bc(n.next), n = e = i), n = n.next;
	} while (n !== e);
	return Ks(n);
}
function Zs(e, t, n, r, i, a) {
	let o = e;
	do {
		let e = o.next.next;
		for (; e !== o.prev;) {
			if (o.i !== e.i && lc(o, e)) {
				let s = vc(o, e);
				o = Ks(o, o.next), s = Ks(s, s.next), qs(o, t, n, r, i, a, 0), qs(s, t, n, r, i, a, 0);
				return;
			}
			e = e.next;
		}
		o = o.next;
	} while (o !== e);
}
function Qs(e, t, n, r) {
	let i = [];
	for (let n = 0, a = t.length; n < a; n++) {
		let o = Gs(e, t[n] * r, n < a - 1 ? t[n + 1] * r : e.length, r, !1);
		o === o.next && (o.steiner = !0), i.push(oc(o));
	}
	i.sort($s);
	for (let e = 0; e < i.length; e++) n = ec(i[e], n);
	return n;
}
function $s(e, t) {
	let n = e.x - t.x;
	return n === 0 && (n = e.y - t.y, n === 0 && (n = (e.next.y - e.y) / (e.next.x - e.x) - (t.next.y - t.y) / (t.next.x - t.x))), n;
}
function ec(e, t) {
	let n = tc(e, t);
	if (!n) return t;
	let r = vc(n, e);
	return Ks(r, r.next), Ks(n, n.next);
}
function tc(e, t) {
	let n = t, r = e.x, i = e.y, a = -Infinity, o;
	if (dc(e, n)) return n;
	do {
		if (dc(e, n.next)) return n.next;
		if (i <= n.y && i >= n.next.y && n.next.y !== n.y) {
			let e = n.x + (i - n.y) * (n.next.x - n.x) / (n.next.y - n.y);
			if (e <= r && e > a && (a = e, o = n.x < n.next.x ? n : n.next, e === r)) return o;
		}
		n = n.next;
	} while (n !== t);
	if (!o) return null;
	let s = o, c = o.x, l = o.y, u = Infinity;
	n = o;
	do {
		if (r >= n.x && n.x >= c && r !== n.x && sc(i < l ? r : a, i, c, l, i < l ? a : r, i, n.x, n.y)) {
			let t = Math.abs(i - n.y) / (r - n.x);
			gc(n, e) && (t < u || t === u && (n.x > o.x || n.x === o.x && nc(o, n))) && (o = n, u = t);
		}
		n = n.next;
	} while (n !== s);
	return o;
}
function nc(e, t) {
	return uc(e.prev, e, t.prev) < 0 && uc(t.next, e, e.next) < 0;
}
function rc(e, t, n, r) {
	let i = e;
	do
		i.z === 0 && (i.z = ac(i.x, i.y, t, n, r)), i.prevZ = i.prev, i.nextZ = i.next, i = i.next;
	while (i !== e);
	i.prevZ.nextZ = null, i.prevZ = null, ic(i);
}
function ic(e) {
	let t, n = 1;
	do {
		let r = e, i;
		e = null;
		let a = null;
		for (t = 0; r;) {
			t++;
			let o = r, s = 0;
			for (let e = 0; e < n && (s++, o = o.nextZ, o); e++);
			let c = n;
			for (; s > 0 || c > 0 && o;) s !== 0 && (c === 0 || !o || r.z <= o.z) ? (i = r, r = r.nextZ, s--) : (i = o, o = o.nextZ, c--), a ? a.nextZ = i : e = i, i.prevZ = a, a = i;
			r = o;
		}
		a.nextZ = null, n *= 2;
	} while (t > 1);
	return e;
}
function ac(e, t, n, r, i) {
	return e = (e - n) * i | 0, t = (t - r) * i | 0, e = (e | e << 8) & 16711935, e = (e | e << 4) & 252645135, e = (e | e << 2) & 858993459, e = (e | e << 1) & 1431655765, t = (t | t << 8) & 16711935, t = (t | t << 4) & 252645135, t = (t | t << 2) & 858993459, t = (t | t << 1) & 1431655765, e | t << 1;
}
function oc(e) {
	let t = e, n = e;
	do
		(t.x < n.x || t.x === n.x && t.y < n.y) && (n = t), t = t.next;
	while (t !== e);
	return n;
}
function sc(e, t, n, r, i, a, o, s) {
	return (i - o) * (t - s) >= (e - o) * (a - s) && (e - o) * (r - s) >= (n - o) * (t - s) && (n - o) * (a - s) >= (i - o) * (r - s);
}
function cc(e, t, n, r, i, a, o, s) {
	return !(e === o && t === s) && sc(e, t, n, r, i, a, o, s);
}
function lc(e, t) {
	return e.next.i !== t.i && e.prev.i !== t.i && !hc(e, t) && (gc(e, t) && gc(t, e) && _c(e, t) && (uc(e.prev, e, t.prev) || uc(e, t.prev, t)) || dc(e, t) && uc(e.prev, e, e.next) > 0 && uc(t.prev, t, t.next) > 0);
}
function uc(e, t, n) {
	return (t.y - e.y) * (n.x - t.x) - (t.x - e.x) * (n.y - t.y);
}
function dc(e, t) {
	return e.x === t.x && e.y === t.y;
}
function fc(e, t, n, r) {
	let i = mc(uc(e, t, n)), a = mc(uc(e, t, r)), o = mc(uc(n, r, e)), s = mc(uc(n, r, t));
	return !!(i !== a && o !== s || i === 0 && pc(e, n, t) || a === 0 && pc(e, r, t) || o === 0 && pc(n, e, r) || s === 0 && pc(n, t, r));
}
function pc(e, t, n) {
	return t.x <= Math.max(e.x, n.x) && t.x >= Math.min(e.x, n.x) && t.y <= Math.max(e.y, n.y) && t.y >= Math.min(e.y, n.y);
}
function mc(e) {
	return e > 0 ? 1 : e < 0 ? -1 : 0;
}
function hc(e, t) {
	let n = e;
	do {
		if (n.i !== e.i && n.next.i !== e.i && n.i !== t.i && n.next.i !== t.i && fc(n, n.next, e, t)) return !0;
		n = n.next;
	} while (n !== e);
	return !1;
}
function gc(e, t) {
	return uc(e.prev, e, e.next) < 0 ? uc(e, t, e.next) >= 0 && uc(e, e.prev, t) >= 0 : uc(e, t, e.prev) < 0 || uc(e, e.next, t) < 0;
}
function _c(e, t) {
	let n = e, r = !1, i = (e.x + t.x) / 2, a = (e.y + t.y) / 2;
	do
		n.y > a != n.next.y > a && n.next.y !== n.y && i < (n.next.x - n.x) * (a - n.y) / (n.next.y - n.y) + n.x && (r = !r), n = n.next;
	while (n !== e);
	return r;
}
function vc(e, t) {
	let n = xc(e.i, e.x, e.y), r = xc(t.i, t.x, t.y), i = e.next, a = t.prev;
	return e.next = t, t.prev = e, n.next = i, i.prev = n, r.next = n, n.prev = r, a.next = r, r.prev = a, r;
}
function yc(e, t, n, r) {
	let i = xc(e, t, n);
	return r ? (i.next = r.next, i.prev = r, r.next.prev = i, r.next = i) : (i.prev = i, i.next = i), i;
}
function bc(e) {
	e.next.prev = e.prev, e.prev.next = e.next, e.prevZ && (e.prevZ.nextZ = e.nextZ), e.nextZ && (e.nextZ.prevZ = e.prevZ);
}
function xc(e, t, n) {
	return {
		i: e,
		x: t,
		y: n,
		prev: null,
		next: null,
		z: 0,
		prevZ: null,
		nextZ: null,
		steiner: !1
	};
}
function Sc(e, t, n, r) {
	let i = 0;
	for (let a = t, o = n - r; a < n; a += r) i += (e[o] - e[a]) * (e[a + 1] + e[o + 1]), o = a;
	return i;
}
var Cc = o((() => {})), wc, Tc = o((() => {
	Cc(), b(), wc = Ws.default || Ws;
})), Ec, Dc = o((() => {
	Ec = /* @__PURE__ */ ((e) => (e[e.NONE = 0] = "NONE", e[e.COLOR = 16384] = "COLOR", e[e.STENCIL = 1024] = "STENCIL", e[e.DEPTH = 256] = "DEPTH", e[e.COLOR_DEPTH = 16640] = "COLOR_DEPTH", e[e.COLOR_STENCIL = 17408] = "COLOR_STENCIL", e[e.DEPTH_STENCIL = 1280] = "DEPTH_STENCIL", e[e.ALL = 17664] = "ALL", e))(Ec || {});
})), Oc, kc = o((() => {
	Oc = class {
		constructor(e) {
			this.items = [], this._name = e;
		}
		emit(e, t, n, r, i, a, o, s) {
			let { name: c, items: l } = this;
			for (let u = 0, d = l.length; u < d; u++) l[u][c](e, t, n, r, i, a, o, s);
			return this;
		}
		add(e) {
			return e[this._name] && (this.remove(e), this.items.push(e)), this;
		}
		remove(e) {
			let t = this.items.indexOf(e);
			return t !== -1 && this.items.splice(t, 1), this;
		}
		contains(e) {
			return this.items.indexOf(e) !== -1;
		}
		removeAll() {
			return this.items.length = 0, this;
		}
		destroy() {
			this.removeAll(), this.items = null, this._name = null;
		}
		get empty() {
			return this.items.length === 0;
		}
		get name() {
			return this._name;
		}
	};
})), Ac, jc, Mc, Nc = o((() => {
	ye(), Bs(), zn(), Us(), Ne(), Le(), Ve(), Dc(), kc(), b(), Ac = [
		"init",
		"destroy",
		"contextChange",
		"resolutionChange",
		"resetState",
		"renderEnd",
		"renderStart",
		"render",
		"update",
		"postrender",
		"prerender"
	], jc = class e extends y {
		constructor(e) {
			super(), this.tick = 0, this.uid = z("renderer"), this.runners = /* @__PURE__ */ Object.create(null), this.renderPipes = /* @__PURE__ */ Object.create(null), this._initOptions = {}, this._systemsHash = /* @__PURE__ */ Object.create(null), this.type = e.type, this.name = e.name, this.config = e;
			let t = [...Ac, ...this.config.runners ?? []];
			this._addRunners(...t), this._unsafeEvalCheck();
		}
		async init(t = {}) {
			await Rs(t.skipExtensionImports === !0 ? !0 : t.manageImports === !1), this._addSystems(this.config.systems), this._addPipes(this.config.renderPipes, this.config.renderPipeAdaptors);
			for (let e in this._systemsHash) t = {
				...this._systemsHash[e].constructor.defaultOptions,
				...t
			};
			t = {
				...e.defaultOptions,
				...t
			}, this._roundPixels = t.roundPixels ? 1 : 0;
			for (let e = 0; e < this.runners.init.items.length; e++) await this.runners.init.items[e].init(t);
			this._initOptions = t;
		}
		render(e, t) {
			this.tick++;
			let n = e;
			if (n instanceof Rn && (n = { container: n }, t && (V(B, "passing a second argument is deprecated, please use render options instead"), n.target = t.renderTexture)), n.target || (n.target = this.view.renderTarget), n.target === this.view.renderTarget && (this._lastObjectRendered = n.container, n.clearColor ?? (n.clearColor = this.background.colorRgba), n.clear ?? (n.clear = this.background.clearBeforeRender)), n.clearColor) {
				let e = Array.isArray(n.clearColor) && n.clearColor.length === 4;
				n.clearColor = e ? n.clearColor : F.shared.setValue(n.clearColor).toArray();
			}
			n.transform || (n.container.updateLocalTransform(), n.transform = n.container.localTransform), n.container.visible && (n.container.enableRenderGroup(), this.runners.prerender.emit(n), this.runners.renderStart.emit(n), this.runners.render.emit(n), this.runners.renderEnd.emit(n), this.runners.postrender.emit(n));
		}
		resize(e, t, n) {
			let r = this.view.resolution;
			this.view.resize(e, t, n), this.emit("resize", this.view.screen.width, this.view.screen.height, this.view.resolution), n !== void 0 && n !== r && this.runners.resolutionChange.emit(n);
		}
		clear(e = {}) {
			let t = this;
			e.target || (e.target = t.renderTarget.renderTarget), e.clearColor || (e.clearColor = this.background.colorRgba), e.clear ?? (e.clear = Ec.ALL);
			let { clear: n, clearColor: r, target: i, mipLevel: a, layer: o } = e;
			F.shared.setValue(r ?? this.background.colorRgba), t.renderTarget.clear(i, n, F.shared.toArray(), a ?? 0, o ?? 0);
		}
		get resolution() {
			return this.view.resolution;
		}
		set resolution(e) {
			this.view.resolution = e, this.runners.resolutionChange.emit(e);
		}
		get width() {
			return this.view.texture.frame.width;
		}
		get height() {
			return this.view.texture.frame.height;
		}
		get canvas() {
			return this.view.canvas;
		}
		get lastObjectRendered() {
			return this._lastObjectRendered;
		}
		get renderingToScreen() {
			return this.renderTarget.renderingToScreen;
		}
		get screen() {
			return this.view.screen;
		}
		_addRunners(...e) {
			e.forEach((e) => {
				this.runners[e] = new Oc(e);
			});
		}
		_addSystems(e) {
			let t;
			for (t in e) {
				let n = e[t];
				this._addSystem(n.value, n.name);
			}
		}
		_addSystem(e, t) {
			let n = new e(this);
			if (this[t]) throw Error(`Whoops! The name "${t}" is already in use`);
			this[t] = n, this._systemsHash[t] = n;
			for (let e in this.runners) this.runners[e].add(n);
			return this;
		}
		_addPipes(e, t) {
			let n = t.reduce((e, t) => (e[t.name] = t.value, e), {});
			e.forEach((e) => {
				let t = e.value, r = e.name, i = n[r];
				this.renderPipes[r] = new t(this, i ? new i() : null), this.runners.destroy.add(this.renderPipes[r]);
			});
		}
		destroy(e = !1) {
			this.runners.destroy.items.reverse(), this.runners.destroy.emit(e), (e === !0 || typeof e == "object" && e.releaseGlobalResources) && Be.release(), Object.values(this.runners).forEach((e) => {
				e.destroy();
			}), this._systemsHash = null, this.renderPipes = null, this.removeAllListeners();
		}
		generateTexture(e) {
			return this.textureGenerator.generateTexture(e);
		}
		get roundPixels() {
			return !!this._roundPixels;
		}
		_unsafeEvalCheck() {
			if (!Vs()) throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.");
		}
		resetState() {
			this.runners.resetState.emit();
		}
	}, jc.defaultOptions = {
		resolution: 1,
		failIfMajorPerformanceCaveat: !1,
		roundPixels: !1
	}, Mc = jc;
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/browser/isWebGLSupported.mjs
function Pc(e) {
	return Fc === void 0 && (Fc = (() => {
		let t = {
			stencil: !0,
			failIfMajorPerformanceCaveat: e ?? Mc.defaultOptions.failIfMajorPerformanceCaveat
		};
		try {
			if (!J.get().getWebGLRenderingContext()) return !1;
			let e = J.get().createCanvas().getContext("webgl", t), n = !!e?.getContextAttributes()?.stencil;
			if (e) {
				let t = e.getExtension("WEBGL_lose_context");
				t && t.loseContext();
			}
			return e = null, n;
		} catch {
			return !1;
		}
	})()), Fc;
}
var Fc, Ic = o((() => {
	Y(), Nc();
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/browser/isWebGPUSupported.mjs
async function Lc(e = {}) {
	return Rc === void 0 && (Rc = await (async () => {
		let t = J.get().getNavigator().gpu;
		if (!t) return !1;
		try {
			return await (await t.requestAdapter(e)).requestDevice(), !0;
		} catch {
			return !1;
		}
	})()), Rc;
}
var Rc, zc = o((() => {
	Y();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/batcher/gpu/getTextureBatchBindGroup.mjs
function Bc(e, t, n) {
	let r = 2166136261;
	for (let n = 0; n < t; n++) r ^= e[n].uid, r = Math.imul(r, 16777619), r >>>= 0;
	return Hc[r] || Vc(e, t, r, n);
}
function Vc(e, t, n, r) {
	let i = {}, a = 0;
	for (let n = 0; n < r; n++) {
		let r = n < t ? e[n] : K.EMPTY.source;
		i[a++] = r.source, i[a++] = r.style;
	}
	let o = new vo(i);
	return Hc[n] = o, o;
}
var Hc, Uc = o((() => {
	yo(), q(), Hc = {};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/utils/addBits.mjs
function Wc(e, t, n) {
	if (e) for (let r in e) {
		let i = t[r.toLocaleLowerCase()];
		if (i) {
			let t = e[r];
			r === "header" && (t = t.replace(/@in\s+[^;]+;\s*/g, "").replace(/@out\s+[^;]+;\s*/g, "")), n && i.push(`//----${n}----//`), i.push(t);
		} else H(`${r} placement hook does not exist in shader`);
	}
}
var Gc = o((() => {
	U();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/utils/compileHooks.mjs
function Kc(e) {
	let t = {};
	return (e.match(qc)?.map((e) => e.replace(/[{()}]/g, "")) ?? []).forEach((e) => {
		t[e] = [];
	}), t;
}
var qc, Jc = o((() => {
	qc = /\{\{(.*?)\}\}/g;
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/utils/compileInputs.mjs
function Yc(e, t) {
	let n, r = /@in\s+([^;]+);/g;
	for (; (n = r.exec(e)) !== null;) t.push(n[1]);
}
function Xc(e, t, n = !1) {
	let r = [];
	Yc(t, r), e.forEach((e) => {
		e.header && Yc(e.header, r);
	});
	let i = r;
	n && i.sort();
	let a = i.map((e, t) => `       @location(${t}) ${e},`).join("\n"), o = t.replace(/@in\s+[^;]+;\s*/g, "");
	return o = o.replace("{{in}}", `
${a}
`), o;
}
var Zc = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/utils/compileOutputs.mjs
function Qc(e, t) {
	let n, r = /@out\s+([^;]+);/g;
	for (; (n = r.exec(e)) !== null;) t.push(n[1]);
}
function $c(e) {
	let t = /\b(\w+)\s*:/g.exec(e);
	return t ? t[1] : "";
}
function el(e) {
	return e.replace(/@.*?\s+/g, "");
}
function tl(e, t) {
	let n = [];
	Qc(t, n), e.forEach((e) => {
		e.header && Qc(e.header, n);
	});
	let r = 0, i = n.sort().map((e) => e.indexOf("builtin") > -1 ? e : `@location(${r++}) ${e}`).join(",\n"), a = n.sort().map((e) => `       var ${el(e)};`).join("\n"), o = `return VSOutput(
            ${n.sort().map((e) => ` ${$c(e)}`).join(",\n")});`, s = t.replace(/@out\s+[^;]+;\s*/g, "");
	return s = s.replace("{{struct}}", `
${i}
`), s = s.replace("{{start}}", `
${a}
`), s = s.replace("{{return}}", `
${o}
`), s;
}
var nl = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/utils/injectBits.mjs
function rl(e, t) {
	let n = e;
	for (let e in t) {
		let r = t[e];
		n = r.join("\n").length ? n.replace(`{{${e}}}`, `//-----${e} START-----//
${r.join("\n")}
//----${e} FINISH----//`) : n.replace(`{{${e}}}`, "");
	}
	return n;
}
var il = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compiler/compileHighShader.mjs
function al({ template: e, bits: t }) {
	let n = cl(e, t);
	if (ul[n]) return ul[n];
	let { vertex: r, fragment: i } = sl(e, t);
	return ul[n] = ll(r, i, t), ul[n];
}
function ol({ template: e, bits: t }) {
	let n = cl(e, t);
	return ul[n] || (ul[n] = ll(e.vertex, e.fragment, t)), ul[n];
}
function sl(e, t) {
	let n = t.map((e) => e.vertex).filter((e) => !!e), r = t.map((e) => e.fragment).filter((e) => !!e), i = Xc(n, e.vertex, !0);
	i = tl(n, i);
	let a = Xc(r, e.fragment, !0);
	return {
		vertex: i,
		fragment: a
	};
}
function cl(e, t) {
	return t.map((e) => (dl.has(e) || dl.set(e, fl++), dl.get(e))).sort((e, t) => e - t).join("-") + e.vertex + e.fragment;
}
function ll(e, t, n) {
	let r = Kc(e), i = Kc(t);
	return n.forEach((e) => {
		Wc(e.vertex, r, e.name), Wc(e.fragment, i, e.name);
	}), {
		vertex: rl(e, r),
		fragment: rl(t, i)
	};
}
var ul, dl, fl, pl = o((() => {
	Gc(), Jc(), Zc(), nl(), il(), ul = /* @__PURE__ */ Object.create(null), dl = /* @__PURE__ */ new Map(), fl = 0;
})), ml, hl, gl, _l, vl = o((() => {
	ml = "\n    @in aPosition: vec2<f32>;\n    @in aUV: vec2<f32>;\n\n    @out @builtin(position) vPosition: vec4<f32>;\n    @out vUV : vec2<f32>;\n    @out vColor : vec4<f32>;\n\n    {{header}}\n\n    struct VSOutput {\n        {{struct}}\n    };\n\n    @vertex\n    fn main( {{in}} ) -> VSOutput {\n\n        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;\n        var modelMatrix = mat3x3<f32>(\n            1.0, 0.0, 0.0,\n            0.0, 1.0, 0.0,\n            0.0, 0.0, 1.0\n          );\n        var position = aPosition;\n        var uv = aUV;\n\n        {{start}}\n\n        vColor = vec4<f32>(1., 1., 1., 1.);\n\n        {{main}}\n\n        vUV = uv;\n\n        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;\n\n        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);\n\n        vColor *= globalUniforms.uWorldColorAlpha;\n\n        {{end}}\n\n        {{return}}\n    };\n", hl = "\n    @in vUV : vec2<f32>;\n    @in vColor : vec4<f32>;\n\n    {{header}}\n\n    @fragment\n    fn main(\n        {{in}}\n      ) -> @location(0) vec4<f32> {\n\n        {{start}}\n\n        var outColor:vec4<f32>;\n\n        {{main}}\n\n        var finalColor:vec4<f32> = outColor * vColor;\n\n        {{end}}\n\n        return finalColor;\n      };\n", gl = "\n    in vec2 aPosition;\n    in vec2 aUV;\n\n    out vec4 vColor;\n    out vec2 vUV;\n\n    {{header}}\n\n    void main(void){\n\n        mat3 worldTransformMatrix = uWorldTransformMatrix;\n        mat3 modelMatrix = mat3(\n            1.0, 0.0, 0.0,\n            0.0, 1.0, 0.0,\n            0.0, 0.0, 1.0\n          );\n        vec2 position = aPosition;\n        vec2 uv = aUV;\n\n        {{start}}\n\n        vColor = vec4(1.);\n\n        {{main}}\n\n        vUV = uv;\n\n        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;\n\n        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);\n\n        vColor *= uWorldColorAlpha;\n\n        {{end}}\n    }\n", _l = "\n\n    in vec4 vColor;\n    in vec2 vUV;\n\n    out vec4 finalColor;\n\n    {{header}}\n\n    void main(void) {\n\n        {{start}}\n\n        vec4 outColor;\n\n        {{main}}\n\n        finalColor = outColor * vColor;\n\n        {{end}}\n    }\n";
})), yl, bl, xl = o((() => {
	yl = {
		name: "global-uniforms-bit",
		vertex: { header: "\n        struct GlobalUniforms {\n            uProjectionMatrix:mat3x3<f32>,\n            uWorldTransformMatrix:mat3x3<f32>,\n            uWorldColorAlpha: vec4<f32>,\n            uResolution: vec2<f32>,\n        }\n\n        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;\n        " }
	}, bl = {
		name: "global-uniforms-bit",
		vertex: { header: "\n          uniform mat3 uProjectionMatrix;\n          uniform mat3 uWorldTransformMatrix;\n          uniform vec4 uWorldColorAlpha;\n          uniform vec2 uResolution;\n        " }
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/compileHighShaderToProgram.mjs
function Sl({ bits: e, name: t }) {
	let n = al({
		template: {
			fragment: hl,
			vertex: ml
		},
		bits: [yl, ...e]
	});
	return go.from({
		name: t,
		vertex: {
			source: n.vertex,
			entryPoint: "main"
		},
		fragment: {
			source: n.fragment,
			entryPoint: "main"
		}
	});
}
function Cl({ bits: e, name: t }) {
	return new qa({
		name: t,
		...ol({
			template: {
				vertex: gl,
				fragment: _l
			},
			bits: [bl, ...e]
		})
	});
}
var wl = o((() => {
	Ja(), _o(), pl(), vl(), xl();
})), Tl, El, Dl = o((() => {
	Tl = {
		name: "color-bit",
		vertex: {
			header: "\n            @in aColor: vec4<f32>;\n        ",
			main: "\n            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);\n        "
		}
	}, El = {
		name: "color-bit",
		vertex: {
			header: "\n            in vec4 aColor;\n        ",
			main: "\n            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);\n        "
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/high-shader/shader-bits/generateTextureBatchBit.mjs
function Ol(e) {
	let t = [];
	if (e === 1) t.push("@group(1) @binding(0) var textureSource1: texture_2d<f32>;"), t.push("@group(1) @binding(1) var textureSampler1: sampler;");
	else {
		let n = 0;
		for (let r = 0; r < e; r++) t.push(`@group(1) @binding(${n++}) var textureSource${r + 1}: texture_2d<f32>;`), t.push(`@group(1) @binding(${n++}) var textureSampler${r + 1}: sampler;`);
	}
	return t.join("\n");
}
function kl(e) {
	let t = [];
	if (e === 1) t.push("outColor = textureSampleGrad(textureSource1, textureSampler1, vUV, uvDx, uvDy);");
	else {
		t.push("switch vTextureId {");
		for (let n = 0; n < e; n++) n === e - 1 ? t.push("  default:{") : t.push(`  case ${n}:{`), t.push(`      outColor = textureSampleGrad(textureSource${n + 1}, textureSampler${n + 1}, vUV, uvDx, uvDy);`), t.push("      break;}");
		t.push("}");
	}
	return t.join("\n");
}
function Al(e) {
	return Nl[e] || (Nl[e] = {
		name: "texture-batch-bit",
		vertex: {
			header: "\n                @in aTextureIdAndRound: vec2<u32>;\n                @out @interpolate(flat) vTextureId : u32;\n            ",
			main: "\n                vTextureId = aTextureIdAndRound.y;\n            ",
			end: "\n                if(aTextureIdAndRound.x == 1)\n                {\n                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);\n                }\n            "
		},
		fragment: {
			header: `
                @in @interpolate(flat) vTextureId: u32;

                ${Ol(e)}
            `,
			main: `
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);

                ${kl(e)}
            `
		}
	}), Nl[e];
}
function jl(e) {
	let t = [];
	for (let n = 0; n < e; n++) n > 0 && t.push("else"), n < e - 1 && t.push(`if(vTextureId < ${n}.5)`), t.push("{"), t.push(`	outColor = texture(uTextures[${n}], vUV);`), t.push("}");
	return t.join("\n");
}
function Ml(e) {
	return Pl[e] || (Pl[e] = {
		name: "texture-batch-bit",
		vertex: {
			header: "\n                in vec2 aTextureIdAndRound;\n                out float vTextureId;\n\n            ",
			main: "\n                vTextureId = aTextureIdAndRound.y;\n            ",
			end: "\n                if(aTextureIdAndRound.x == 1.)\n                {\n                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n                }\n            "
		},
		fragment: {
			header: `
                in float vTextureId;

                uniform sampler2D uTextures[${e}];

            `,
			main: `

                ${jl(e)}
            `
		}
	}), Pl[e];
}
var Nl, Pl, Fl = o((() => {
	Nl = {}, Pl = {};
})), Il, Ll, Rl, zl = o((() => {
	Il = {
		name: "local-uniform-bit",
		vertex: {
			header: "\n\n            struct LocalUniforms {\n                uTransformMatrix:mat3x3<f32>,\n                uColor:vec4<f32>,\n                uRound:f32,\n            }\n\n            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;\n        ",
			main: "\n            vColor *= localUniforms.uColor;\n            modelMatrix *= localUniforms.uTransformMatrix;\n        ",
			end: "\n            if(localUniforms.uRound == 1)\n            {\n                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);\n            }\n        "
		}
	}, Ll = {
		...Il,
		vertex: {
			...Il.vertex,
			header: Il.vertex.header.replace("group(1)", "group(2)")
		}
	}, Rl = {
		name: "local-uniform-bit",
		vertex: {
			header: "\n\n            uniform mat3 uTransformMatrix;\n            uniform vec4 uColor;\n            uniform float uRound;\n        ",
			main: "\n            vColor *= uColor;\n            modelMatrix = uTransformMatrix;\n        ",
			end: "\n            if(uRound == 1.)\n            {\n                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);\n            }\n        "
		}
	};
})), Bl, Vl, Hl = o((() => {
	Bl = {
		name: "round-pixels-bit",
		vertex: { header: "\n            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32>\n            {\n                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n            }\n        " }
	}, Vl = {
		name: "round-pixels-bit",
		vertex: { header: "\n            vec2 roundPixels(vec2 position, vec2 targetSize)\n            {\n                return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;\n            }\n        " }
	};
})), Ul, Wl = o((() => {
	g(), R(), Uc(), wl(), Dl(), Fl(), zl(), Hl(), jo(), ko(), Ul = class {
		constructor() {
			this._maxTextures = 0;
		}
		contextChange(e) {
			let t = new Oo({
				uTransformMatrix: {
					value: new L(),
					type: "mat3x3<f32>"
				},
				uColor: {
					value: new Float32Array([
						1,
						1,
						1,
						1
					]),
					type: "vec4<f32>"
				},
				uRound: {
					value: 0,
					type: "f32"
				}
			});
			this._maxTextures = e.limits.maxBatchableTextures, this.shader = new Ao({
				gpuProgram: Sl({
					name: "graphics",
					bits: [
						Tl,
						Al(this._maxTextures),
						Ll,
						Bl
					]
				}),
				resources: { localUniforms: t }
			});
		}
		execute(e, t) {
			let n = t.context, r = n.customShader || this.shader, i = e.renderer, { batcher: a, instructions: o } = i.graphicsContext.getContextRenderData(n), s = i.encoder;
			s.setGeometry(a.geometry, r.gpuProgram);
			let c = i.globalUniforms.bindGroup;
			s.setBindGroup(0, c, r.gpuProgram);
			let l = i.renderPipes.uniformBatch.getUniformBindGroup(r.resources.localUniforms, !0);
			s.setBindGroup(2, l, r.gpuProgram);
			let u = o.instructions, d = null;
			for (let t = 0; t < o.instructionSize; t++) {
				let n = u[t];
				if (n.topology !== d && (d = n.topology, s.setPipelineFromGeometryProgramAndState(a.geometry, r.gpuProgram, e.state, n.topology)), r.groups[1] = n.bindGroup, !n.gpuBindGroup) {
					let e = n.textures;
					n.bindGroup = Bc(e.textures, e.count, this._maxTextures), n.gpuBindGroup = i.bindGroup.getBindGroup(n.bindGroup, r.gpuProgram, 1);
				}
				s.setBindGroup(1, n.bindGroup, r.gpuProgram), s.renderPassEncoder.drawIndexed(n.size, 1, n.start);
			}
		}
		destroy() {
			this.shader.destroy(!0), this.shader = null;
		}
	}, Ul.extension = {
		type: [f.WebGPUPipesAdaptor],
		name: "graphics"
	};
})), Gl, Kl, ql = o((() => {
	Gl = {
		name: "texture-bit",
		vertex: {
			header: "\n\n        struct TextureUniforms {\n            uTextureMatrix:mat3x3<f32>,\n        }\n\n        @group(2) @binding(2) var<uniform> textureUniforms : TextureUniforms;\n        ",
			main: "\n            uv = (textureUniforms.uTextureMatrix * vec3(uv, 1.0)).xy;\n        "
		},
		fragment: {
			header: "\n            @group(2) @binding(0) var uTexture: texture_2d<f32>;\n            @group(2) @binding(1) var uSampler: sampler;\n\n\n        ",
			main: "\n            outColor = textureSample(uTexture, uSampler, vUV);\n        "
		}
	}, Kl = {
		name: "texture-bit",
		vertex: {
			header: "\n            uniform mat3 uTextureMatrix;\n        ",
			main: "\n            uv = (uTextureMatrix * vec3(uv, 1.0)).xy;\n        "
		},
		fragment: {
			header: "\n        uniform sampler2D uTexture;\n\n\n        ",
			main: "\n            outColor = texture(uTexture, vUV);\n        "
		}
	};
})), Jl, Yl = o((() => {
	g(), R(), wl(), zl(), Hl(), ql(), jo(), q(), U(), Jl = class {
		init() {
			this._shader = new Ao({
				gpuProgram: Sl({
					name: "mesh",
					bits: [
						Il,
						Gl,
						Bl
					]
				}),
				resources: {
					uTexture: K.EMPTY._source,
					uSampler: K.EMPTY._source.style,
					textureUniforms: { uTextureMatrix: {
						type: "mat3x3<f32>",
						value: new L()
					} }
				}
			});
		}
		execute(e, t) {
			let n = e.renderer, r = t._shader;
			if (!r) r = this._shader, r.groups[2] = n.texture.getTextureBindGroup(t.texture);
			else if (!r.gpuProgram) {
				H("Mesh shader has no gpuProgram", t.shader);
				return;
			}
			let i = r.gpuProgram;
			if (i.autoAssignGlobalUniforms && (r.groups[0] = n.globalUniforms.bindGroup), i.autoAssignLocalUniforms) {
				let t = e.localUniforms;
				r.groups[1] = n.renderPipes.uniformBatch.getUniformBindGroup(t, !0);
			}
			n.encoder.draw({
				geometry: t._geometry,
				shader: r,
				state: t.state
			});
		}
		destroy() {
			this._shader.destroy(!0), this._shader = null;
		}
	}, Jl.extension = {
		type: [f.WebGPUPipesAdaptor],
		name: "mesh"
	};
})), Xl, Zl, Ql = o((() => {
	g(), Vo(), Uc(), Xl = Bo.for2d(), Zl = class {
		start(e, t, n) {
			let r = e.renderer, i = r.encoder, a = n.gpuProgram;
			this._shader = n, this._geometry = t, i.setGeometry(t, a), Xl.blendMode = "normal", r.pipeline.getPipeline(t, a, Xl);
			let o = r.globalUniforms.bindGroup;
			i.resetBindGroup(1), i.setBindGroup(0, o, a);
		}
		execute(e, t) {
			let n = this._shader.gpuProgram, r = e.renderer, i = r.encoder;
			if (!t.bindGroup) {
				let e = t.textures;
				t.bindGroup = Bc(e.textures, e.count, r.limits.maxBatchableTextures);
			}
			Xl.blendMode = t.blendMode;
			let a = r.bindGroup.getBindGroup(t.bindGroup, n, 1), o = r.pipeline.getPipeline(this._geometry, n, Xl, t.topology);
			t.bindGroup._touch(r.gc.now, r.tick), i.setPipeline(o), i.renderPassEncoder.setBindGroup(1, a), i.renderPassEncoder.drawIndexed(t.size, 1, t.start);
		}
	}, Zl.extension = {
		type: [f.WebGPUPipesAdaptor],
		name: "batch"
	};
})), $l, eu = o((() => {
	g(), $l = class {
		constructor(e) {
			this._renderer = e;
		}
		updateRenderable() {}
		destroyRenderable() {}
		validateRenderable() {
			return !1;
		}
		addRenderable(e, t) {
			this._renderer.renderPipes.batch.break(t), t.add(e);
		}
		execute(e) {
			e.isRenderable && e.render(this._renderer);
		}
		destroy() {
			this._renderer = null;
		}
	}, $l.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "customRender"
	};
})), tu, nu = o((() => {
	tu = class {
		constructor() {
			this.batcherName = "default", this.topology = "triangle-list", this.attributeSize = 4, this.indexSize = 6, this.packAsQuad = !0, this.roundPixels = 0, this._attributeStart = 0, this._batcher = null, this._batch = null;
		}
		get blendMode() {
			return this.renderable.groupBlendMode;
		}
		get color() {
			return this.renderable.groupColorAlpha;
		}
		reset() {
			this.renderable = null, this.texture = null, this._batcher = null, this._batch = null, this.bounds = null;
		}
		destroy() {
			this.reset();
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/executeInstructions.mjs
function ru(e, t) {
	let n = e.instructionSet, r = n.instructions;
	for (let e = 0; e < n.instructionSize; e++) {
		let n = r[e];
		t[n.renderPipeId].execute(n);
	}
}
var iu = o((() => {})), au, ou = o((() => {
	g(), R(), Ke(), nu(), iu(), au = class {
		constructor(e) {
			this._renderer = e;
		}
		addRenderGroup(e, t) {
			e.isCachedAsTexture ? this._addRenderableCacheAsTexture(e, t) : this._addRenderableDirect(e, t);
		}
		execute(e) {
			e.isRenderable && (e.isCachedAsTexture ? this._executeCacheAsTexture(e) : this._executeDirect(e));
		}
		destroy() {
			this._renderer = null;
		}
		_addRenderableDirect(e, t) {
			this._renderer.renderPipes.batch.break(t), e._batchableRenderGroup && (Ge.return(e._batchableRenderGroup), e._batchableRenderGroup = null), t.add(e);
		}
		_addRenderableCacheAsTexture(e, t) {
			let n = e._batchableRenderGroup ?? (e._batchableRenderGroup = Ge.get(tu));
			n.renderable = e.root, n.transform = e.root.relativeGroupTransform, n.texture = e.texture, n.bounds = e._textureBounds, t.add(e), this._renderer.renderPipes.blendMode.pushBlendMode(e, e.root.groupBlendMode, t), this._renderer.renderPipes.batch.addToBatch(n, t), this._renderer.renderPipes.blendMode.popBlendMode(t);
		}
		_executeCacheAsTexture(e) {
			if (e.textureNeedsUpdate) {
				e.textureNeedsUpdate = !1;
				let t = new L().translate(-e._textureBounds.x, -e._textureBounds.y);
				this._renderer.renderTarget.push(e.texture, !0, null, e.texture.frame), this._renderer.globalUniforms.push({
					worldTransformMatrix: t,
					worldColor: 4294967295,
					offset: {
						x: 0,
						y: 0
					}
				}), ru(e, this._renderer.renderPipes), this._renderer.renderTarget.finishRenderPass(), this._renderer.renderTarget.pop(), this._renderer.globalUniforms.pop();
			}
			e._batchableRenderGroup._batcher.updateElement(e._batchableRenderGroup), e._batchableRenderGroup._batcher.geometry.buffers[0].update();
		}
		_executeDirect(e) {
			this._renderer.globalUniforms.push({
				worldTransformMatrix: e.inverseParentTextureTransform,
				worldColor: e.worldColorAlpha
			}), ru(e, this._renderer.renderPipes), this._renderer.globalUniforms.pop();
		}
	}, au.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "renderGroup"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/clearList.mjs
function su(e, t) {
	t || (t = 0);
	for (let n = t; n < e.length && e[n]; n++) e[n] = null;
}
var cu = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/updateRenderGroupTransforms.mjs
function lu(e, t = !1) {
	uu(e);
	let n = e.childrenToUpdate, r = e.updateTick++;
	for (let t in n) {
		let i = Number(t), a = n[t], o = a.list, s = a.index;
		for (let t = 0; t < s; t++) {
			let n = o[t];
			n.parentRenderGroup === e && n.relativeRenderGroupDepth === i && du(n, r, 0);
		}
		su(o, s), a.index = 0;
	}
	if (t) for (let n = 0; n < e.renderGroupChildren.length; n++) lu(e.renderGroupChildren[n], t);
}
function uu(e) {
	let t = e.root, n;
	if (e.renderGroupParent) {
		let r = e.renderGroupParent;
		e.worldTransform.appendFrom(t.relativeGroupTransform, r.worldTransform), e.worldColor = Dt(t.groupColor, r.worldColor), n = t.groupAlpha * r.worldAlpha;
	} else e.worldTransform.copyFrom(t.localTransform), e.worldColor = t.localColor, n = t.localAlpha;
	n = n < 0 ? 0 : n > 1 ? 1 : n, e.worldAlpha = n, e.worldColorAlpha = e.worldColor + ((n * 255 | 0) << 24);
}
function du(e, t, n) {
	if (t === e.updateTick) return;
	e.updateTick = t, e.didChange = !1;
	let r = e.localTransform;
	e.updateLocalTransform();
	let i = e.parent;
	if (i && !i.renderGroup ? (n |= e._updateFlags, e.relativeGroupTransform.appendFrom(r, i.relativeGroupTransform), n & mu && fu(e, i, n)) : (n = e._updateFlags, e.relativeGroupTransform.copyFrom(r), n & mu && fu(e, pu, n)), !e.renderGroup) {
		let r = e.children, i = r.length;
		for (let e = 0; e < i; e++) du(r[e], t, n);
		let a = e.parentRenderGroup, o = e;
		o.renderPipeId && !a.structureDidChange && a.updateRenderable(o);
	}
}
function fu(e, t, n) {
	if (n & 1) {
		e.groupColor = Dt(e.localColor, t.groupColor);
		let n = e.localAlpha * t.groupAlpha;
		n = n < 0 ? 0 : n > 1 ? 1 : n, e.groupAlpha = n, e.groupColorAlpha = e.groupColor + ((n * 255 | 0) << 24);
	}
	n & 2 && (e.groupBlendMode = e.localBlendMode === "inherit" ? t.groupBlendMode : e.localBlendMode), n & 4 && (e.globalDisplayStatus = e.localDisplayStatus & t.globalDisplayStatus), e._updateFlags = 0;
}
var pu, mu, hu = o((() => {
	zn(), cu(), kt(), pu = new Rn(), mu = 7;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/container/utils/validateRenderables.mjs
function gu(e, t) {
	let { list: n } = e.childrenRenderablesToUpdate, r = !1;
	for (let i = 0; i < e.childrenRenderablesToUpdate.index; i++) {
		let e = n[i];
		if (r = t[e.renderPipeId].validateRenderable(e), r) break;
	}
	return e.structureDidChange = r, r;
}
var _u = o((() => {})), vu, yu, bu = o((() => {
	g(), R(), kn(), on(), mt(), cu(), iu(), hu(), _u(), vu = new L(), yu = class {
		constructor(e) {
			this._renderer = e;
		}
		render({ container: e, transform: t }) {
			let n = e.parent, r = e.renderGroup.renderGroupParent;
			e.parent = null, e.renderGroup.renderGroupParent = null;
			let i = this._renderer, a = vu;
			t && (a.copyFrom(e.renderGroup.localTransform), e.renderGroup.localTransform.copyFrom(t));
			let o = i.renderPipes;
			this._updateCachedRenderGroups(e.renderGroup, null), this._updateRenderGroups(e.renderGroup), i.globalUniforms.start({
				worldTransformMatrix: t ? e.renderGroup.localTransform : e.renderGroup.worldTransform,
				worldColor: e.renderGroup.worldColorAlpha
			}), ru(e.renderGroup, o), o.uniformBatch && o.uniformBatch.renderEnd(), t && e.renderGroup.localTransform.copyFrom(a), e.parent = n, e.renderGroup.renderGroupParent = r;
		}
		destroy() {
			this._renderer = null;
		}
		_updateCachedRenderGroups(e, t) {
			if (e._parentCacheAsTextureRenderGroup = t, e.isCachedAsTexture) {
				if (!e.textureNeedsUpdate) return;
				t = e;
			}
			for (let n = e.renderGroupChildren.length - 1; n >= 0; n--) this._updateCachedRenderGroups(e.renderGroupChildren[n], t);
			if (e.invalidateMatrices(), e.isCachedAsTexture) {
				if (e.textureNeedsUpdate) {
					let t = e.root.getLocalBounds(), n = this._renderer, r = e.textureOptions.resolution || n.view.resolution, i = e.textureOptions.antialias ?? n.view.antialias, a = e.textureOptions.scaleMode ?? "linear", o = e.texture;
					t.ceil(), e.texture && On.returnTexture(e.texture, !0);
					let s = On.getOptimalTexture(t.width, t.height, r, i);
					s._source.style = new an({ scaleMode: a }), e.texture = s, e._textureBounds || (e._textureBounds = new pt()), e._textureBounds.copyFrom(t), o !== e.texture && e.renderGroupParent && (e.renderGroupParent.structureDidChange = !0);
				}
			} else e.texture && (On.returnTexture(e.texture, !0), e.texture = null);
		}
		_updateRenderGroups(e) {
			let t = this._renderer, n = t.renderPipes;
			if (e.runOnRender(t), e.instructionSet.renderPipes = n, e.structureDidChange ? su(e.childrenRenderablesToUpdate.list, 0) : gu(e, n), lu(e), e.structureDidChange ? (e.structureDidChange = !1, this._buildInstructions(e, t)) : this._updateRenderables(e), e.childrenRenderablesToUpdate.index = 0, t.renderPipes.batch.upload(e.instructionSet), !(e.isCachedAsTexture && !e.textureNeedsUpdate)) for (let t = 0; t < e.renderGroupChildren.length; t++) this._updateRenderGroups(e.renderGroupChildren[t]);
		}
		_updateRenderables(e) {
			let { list: t, index: n } = e.childrenRenderablesToUpdate;
			for (let r = 0; r < n; r++) {
				let n = t[r];
				n.didViewUpdate && e.updateRenderable(n);
			}
			su(t, n);
		}
		_buildInstructions(e, t) {
			let n = e.root, r = e.instructionSet;
			r.reset();
			let i = t.renderPipes ? t : t.batch.renderer, a = i.renderPipes;
			a.batch.buildStart(r), a.blendMode.buildStart(), a.colorMask.buildStart(), n.sortableChildren && n.sortChildren(), n.collectRenderablesWithEffects(r, i, null), a.batch.buildEnd(r), a.blendMode.buildEnd(r);
		}
	}, yu.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "renderGroup"
	};
})), xu, Su = o((() => {
	g(), nu(), xu = class {
		constructor(e) {
			this._renderer = e;
		}
		addRenderable(e, t) {
			let n = this._getGpuSprite(e);
			e.didViewUpdate && this._updateBatchableSprite(e, n), this._renderer.renderPipes.batch.addToBatch(n, t);
		}
		updateRenderable(e) {
			let t = this._getGpuSprite(e);
			e.didViewUpdate && this._updateBatchableSprite(e, t), t._batcher.updateElement(t);
		}
		validateRenderable(e) {
			let t = this._getGpuSprite(e);
			return !t._batcher.checkAndUpdateTexture(t, e._texture);
		}
		_updateBatchableSprite(e, t) {
			t.bounds = e.visualBounds, t.texture = e._texture;
		}
		_getGpuSprite(e) {
			return e._gpuData[this._renderer.uid] || this._initGPUSprite(e);
		}
		_initGPUSprite(e) {
			let t = new tu();
			return t.renderable = e, t.transform = e.groupTransform, t.texture = e._texture, t.bounds = e.visualBounds, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._gpuData[this._renderer.uid] = t, t;
		}
		destroy() {
			this._renderer = null;
		}
	}, xu.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "sprite"
	};
})), Cu, wu = o((() => {
	b(), Cu = "8.17.1";
})), Tu, Eu, Du = o((() => {
	g(), wu(), Tu = class {
		static init() {
			globalThis.__PIXI_APP_INIT__?.(this, Cu);
		}
		static destroy() {}
	}, Tu.extension = f.Application, Eu = class {
		constructor(e) {
			this._renderer = e;
		}
		init() {
			globalThis.__PIXI_RENDERER_INIT__?.(this._renderer, Cu);
		}
		destroy() {
			this._renderer = null;
		}
	}, Eu.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "initHook",
		priority: -10
	};
})), Ou, ku = o((() => {
	Ou = class {
		constructor(e) {
			typeof e == "number" ? this.rawBinaryData = new ArrayBuffer(e) : e instanceof Uint8Array ? this.rawBinaryData = e.buffer : this.rawBinaryData = e, this.uint32View = new Uint32Array(this.rawBinaryData), this.float32View = new Float32Array(this.rawBinaryData), this.size = this.rawBinaryData.byteLength;
		}
		get int8View() {
			return this._int8View || (this._int8View = new Int8Array(this.rawBinaryData)), this._int8View;
		}
		get uint8View() {
			return this._uint8View || (this._uint8View = new Uint8Array(this.rawBinaryData)), this._uint8View;
		}
		get int16View() {
			return this._int16View || (this._int16View = new Int16Array(this.rawBinaryData)), this._int16View;
		}
		get int32View() {
			return this._int32View || (this._int32View = new Int32Array(this.rawBinaryData)), this._int32View;
		}
		get float64View() {
			return this._float64Array || (this._float64Array = new Float64Array(this.rawBinaryData)), this._float64Array;
		}
		get bigUint64View() {
			return this._bigUint64Array || (this._bigUint64Array = new BigUint64Array(this.rawBinaryData)), this._bigUint64Array;
		}
		view(e) {
			return this[`${e}View`];
		}
		destroy() {
			this.rawBinaryData = null, this.uint32View = null, this.float32View = null, this.uint16View = null, this._int8View = null, this._uint8View = null, this._int16View = null, this._int32View = null, this._float64Array = null, this._bigUint64Array = null;
		}
		static sizeOf(e) {
			switch (e) {
				case "int8":
				case "uint8": return 1;
				case "int16":
				case "uint16": return 2;
				case "int32":
				case "uint32":
				case "float32": return 4;
				default: throw Error(`${e} isn't a valid view type`);
			}
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/buffer/utils/fastCopy.mjs
function Au(e, t, n, r) {
	if (n ?? (n = 0), r ?? (r = Math.min(e.byteLength - n, t.byteLength)), !(n & 7) && !(r & 7)) {
		let i = r / 8;
		new Float64Array(t, 0, i).set(new Float64Array(e, n, i));
	} else if (!(n & 3) && !(r & 3)) {
		let i = r / 4;
		new Float32Array(t, 0, i).set(new Float32Array(e, n, i));
	} else new Uint8Array(t).set(new Uint8Array(e, n, r));
}
var ju = o((() => {})), Mu, Nu, Pu = o((() => {
	Mu = {
		normal: "normal-npm",
		add: "add-npm",
		screen: "screen-npm"
	}, Nu = /* @__PURE__ */ ((e) => (e[e.DISABLED = 0] = "DISABLED", e[e.RENDERING_MASK_ADD = 1] = "RENDERING_MASK_ADD", e[e.MASK_ACTIVE = 2] = "MASK_ACTIVE", e[e.INVERSE_MASK_ACTIVE = 3] = "INVERSE_MASK_ACTIVE", e[e.RENDERING_MASK_REMOVE = 4] = "RENDERING_MASK_REMOVE", e[e.NONE = 5] = "NONE", e))(Nu || {});
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/state/getAdjustedBlendModeBlend.mjs
function Fu(e, t) {
	return t.alphaMode === "no-premultiply-alpha" && Mu[e] || e;
}
var Iu = o((() => {
	Pu();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/batcher/gl/utils/checkMaxIfStatementsInShader.mjs
function Lu(e) {
	let t = "";
	for (let n = 0; n < e; ++n) n > 0 && (t += "\nelse "), n < e - 1 && (t += `if(test == ${n}.0){}`);
	return t;
}
function Ru(e, t) {
	if (e === 0) throw Error("Invalid value of `0` passed to `checkMaxIfStatementsInShader`");
	let n = t.createShader(t.FRAGMENT_SHADER);
	try {
		for (;;) {
			let r = zu.replace(/%forloop%/gi, Lu(e));
			if (t.shaderSource(n, r), t.compileShader(n), !t.getShaderParameter(n, t.COMPILE_STATUS)) e = e / 2 | 0;
			else break;
		}
	} finally {
		t.deleteShader(n);
	}
	return e;
}
var zu, Bu = o((() => {
	zu = [
		"precision mediump float;",
		"void main(void){",
		"float test = 0.1;",
		"%forloop%",
		"gl_FragColor = vec4(0.0);",
		"}"
	].join("\n");
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/batcher/gl/utils/maxRecommendedTextures.mjs
function Vu() {
	if (Hu) return Hu;
	let e = Ea();
	return Hu = e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS), Hu = Ru(Hu, e), e.getExtension("WEBGL_lose_context")?.loseContext(), Hu;
}
var Hu, Uu = o((() => {
	Oa(), Bu(), Hu = null;
})), Wu, Gu = o((() => {
	Wu = class {
		constructor() {
			this.ids = /* @__PURE__ */ Object.create(null), this.textures = [], this.count = 0;
		}
		clear() {
			for (let e = 0; e < this.count; e++) {
				let t = this.textures[e];
				this.textures[e] = null, this.ids[t.uid] = null;
			}
			this.count = 0;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/batcher/shared/Batcher.mjs
function Ku() {
	return Xu > 0 ? Yu[--Xu] : new Ju();
}
function qu(e) {
	e.elements = null, Yu[Xu++] = e;
}
var Ju, Yu, Xu, Zu, Qu, $u, ed = o((() => {
	Ne(), ku(), Le(), Ve(), ju(), Iu(), Uu(), Gu(), Ju = class {
		constructor() {
			this.renderPipeId = "batch", this.action = "startBatch", this.start = 0, this.size = 0, this.textures = new Wu(), this.blendMode = "normal", this.topology = "triangle-strip", this.canBundle = !0;
		}
		destroy() {
			this.textures = null, this.gpuBindGroup = null, this.bindGroup = null, this.batcher = null, this.elements = null;
		}
	}, Yu = [], Xu = 0, Be.register({ clear: () => {
		if (Yu.length > 0) for (let e of Yu) e && e.destroy();
		Yu.length = 0, Xu = 0;
	} }), Zu = 0, Qu = class e {
		constructor(t) {
			this.uid = z("batcher"), this.dirty = !0, this.batchIndex = 0, this.batches = [], this._elements = [], t = {
				...e.defaultOptions,
				...t
			}, t.maxTextures || (V("v8.8.0", "maxTextures is a required option for Batcher now, please pass it in the options"), t.maxTextures = Vu());
			let { maxTextures: n, attributesInitialSize: r, indicesInitialSize: i } = t;
			this.attributeBuffer = new Ou(r * 4), this.indexBuffer = new Uint16Array(i), this.maxTextures = n;
		}
		begin() {
			this.elementSize = 0, this.elementStart = 0, this.indexSize = 0, this.attributeSize = 0;
			for (let e = 0; e < this.batchIndex; e++) qu(this.batches[e]);
			this.batchIndex = 0, this._batchIndexStart = 0, this._batchIndexSize = 0, this.dirty = !0;
		}
		add(e) {
			this._elements[this.elementSize++] = e, e._indexStart = this.indexSize, e._attributeStart = this.attributeSize, e._batcher = this, this.indexSize += e.indexSize, this.attributeSize += e.attributeSize * this.vertexSize;
		}
		checkAndUpdateTexture(e, t) {
			let n = e._batch.textures.ids[t._source.uid];
			return !n && n !== 0 ? !1 : (e._textureId = n, e.texture = t, !0);
		}
		updateElement(e) {
			this.dirty = !0;
			let t = this.attributeBuffer;
			e.packAsQuad ? this.packQuadAttributes(e, t.float32View, t.uint32View, e._attributeStart, e._textureId) : this.packAttributes(e, t.float32View, t.uint32View, e._attributeStart, e._textureId);
		}
		break(e) {
			let t = this._elements;
			if (!t[this.elementStart]) return;
			let n = Ku(), r = n.textures;
			r.clear();
			let i = t[this.elementStart], a = Fu(i.blendMode, i.texture._source), o = i.topology;
			this.attributeSize * 4 > this.attributeBuffer.size && this._resizeAttributeBuffer(this.attributeSize * 4), this.indexSize > this.indexBuffer.length && this._resizeIndexBuffer(this.indexSize);
			let s = this.attributeBuffer.float32View, c = this.attributeBuffer.uint32View, l = this.indexBuffer, u = this._batchIndexSize, d = this._batchIndexStart, f = "startBatch", p = [], m = this.maxTextures;
			for (let i = this.elementStart; i < this.elementSize; ++i) {
				let h = t[i];
				t[i] = null;
				let g = h.texture._source, _ = Fu(h.blendMode, g), v = a !== _ || o !== h.topology;
				if (g._batchTick === Zu && !v) {
					h._textureId = g._textureBindLocation, u += h.indexSize, h.packAsQuad ? (this.packQuadAttributes(h, s, c, h._attributeStart, h._textureId), this.packQuadIndex(l, h._indexStart, h._attributeStart / this.vertexSize)) : (this.packAttributes(h, s, c, h._attributeStart, h._textureId), this.packIndex(h, l, h._indexStart, h._attributeStart / this.vertexSize)), h._batch = n, p.push(h);
					continue;
				}
				g._batchTick = Zu, (r.count >= m || v) && (this._finishBatch(n, d, u - d, r, a, o, e, f, p), f = "renderBatch", d = u, a = _, o = h.topology, n = Ku(), r = n.textures, r.clear(), p = [], ++Zu), h._textureId = g._textureBindLocation = r.count, r.ids[g.uid] = r.count, r.textures[r.count++] = g, h._batch = n, p.push(h), u += h.indexSize, h.packAsQuad ? (this.packQuadAttributes(h, s, c, h._attributeStart, h._textureId), this.packQuadIndex(l, h._indexStart, h._attributeStart / this.vertexSize)) : (this.packAttributes(h, s, c, h._attributeStart, h._textureId), this.packIndex(h, l, h._indexStart, h._attributeStart / this.vertexSize));
			}
			r.count > 0 && (this._finishBatch(n, d, u - d, r, a, o, e, f, p), d = u, ++Zu), this.elementStart = this.elementSize, this._batchIndexStart = d, this._batchIndexSize = u;
		}
		_finishBatch(e, t, n, r, i, a, o, s, c) {
			e.gpuBindGroup = null, e.bindGroup = null, e.action = s, e.batcher = this, e.textures = r, e.blendMode = i, e.topology = a, e.start = t, e.size = n, e.elements = c, ++Zu, this.batches[this.batchIndex++] = e, o.add(e);
		}
		finish(e) {
			this.break(e);
		}
		ensureAttributeBuffer(e) {
			e * 4 <= this.attributeBuffer.size || this._resizeAttributeBuffer(e * 4);
		}
		ensureIndexBuffer(e) {
			e <= this.indexBuffer.length || this._resizeIndexBuffer(e);
		}
		_resizeAttributeBuffer(e) {
			let t = new Ou(Math.max(e, this.attributeBuffer.size * 2));
			Au(this.attributeBuffer.rawBinaryData, t.rawBinaryData), this.attributeBuffer = t;
		}
		_resizeIndexBuffer(e) {
			let t = this.indexBuffer, n = Math.max(e, t.length * 1.5);
			n += n % 2;
			let r = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
			if (r.BYTES_PER_ELEMENT !== t.BYTES_PER_ELEMENT) for (let e = 0; e < t.length; e++) r[e] = t[e];
			else Au(t.buffer, r.buffer);
			this.indexBuffer = r;
		}
		packQuadIndex(e, t, n) {
			e[t] = n + 0, e[t + 1] = n + 1, e[t + 2] = n + 2, e[t + 3] = n + 0, e[t + 4] = n + 2, e[t + 5] = n + 3;
		}
		packIndex(e, t, n, r) {
			let i = e.indices, a = e.indexSize, o = e.indexOffset, s = e.attributeOffset;
			for (let e = 0; e < a; e++) t[n++] = r + i[e + o] - s;
		}
		destroy(e = {}) {
			if (this.batches !== null) {
				for (let e = 0; e < this.batchIndex; e++) qu(this.batches[e]);
				this.batches = null, this.geometry.destroy(!0), this.geometry = null, e.shader && (this.shader?.destroy(), this.shader = null);
				for (let e = 0; e < this._elements.length; e++) this._elements[e] && (this._elements[e]._batch = null);
				this._elements = null, this.indexBuffer = null, this.attributeBuffer.destroy(), this.attributeBuffer = null;
			}
		}
	}, Qu.defaultOptions = {
		maxTextures: null,
		attributesInitialSize: 4,
		indicesInitialSize: 6
	}, $u = Qu;
})), td, nd, rd, id = o((() => {
	ts(), $o(), cs(), td = new Float32Array(1), nd = new Uint32Array(1), rd = class extends ss {
		constructor() {
			let e = new es({
				data: td,
				label: "attribute-batch-buffer",
				usage: X.VERTEX | X.COPY_DST,
				shrinkToFit: !1
			}), t = new es({
				data: nd,
				label: "index-batch-buffer",
				usage: X.INDEX | X.COPY_DST,
				shrinkToFit: !1
			});
			super({
				attributes: {
					aPosition: {
						buffer: e,
						format: "float32x2",
						stride: 24,
						offset: 0
					},
					aUV: {
						buffer: e,
						format: "float32x2",
						stride: 24,
						offset: 8
					},
					aColor: {
						buffer: e,
						format: "unorm8x4",
						stride: 24,
						offset: 16
					},
					aTextureIdAndRound: {
						buffer: e,
						format: "uint16x2",
						stride: 24,
						offset: 20
					}
				},
				indexBuffer: t
			});
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/getBatchSamplersUniformGroup.mjs
function ad(e) {
	let t = od[e];
	if (t) return t;
	let n = new Int32Array(e);
	for (let t = 0; t < e; t++) n[t] = t;
	return t = od[e] = new Oo({ uTextures: {
		value: n,
		type: "i32",
		size: e
	} }, { isStatic: !0 }), t;
}
var od, sd = o((() => {
	ko(), od = {};
})), cd, ld = o((() => {
	wl(), Dl(), Fl(), Hl(), sd(), jo(), cd = class extends Ao {
		constructor(e) {
			let t = Cl({
				name: "batch",
				bits: [
					El,
					Ml(e),
					Vl
				]
			}), n = Sl({
				name: "batch",
				bits: [
					Tl,
					Al(e),
					Bl
				]
			});
			super({
				glProgram: t,
				gpuProgram: n,
				resources: { batchSamplers: ad(e) }
			}), this.maxTextures = e;
		}
	};
})), ud, dd, fd, pd = o((() => {
	g(), ed(), id(), ld(), ud = null, dd = class e extends $u {
		constructor(t) {
			super(t), this.geometry = new rd(), this.name = e.extension.name, this.vertexSize = 6, ud ?? (ud = new cd(t.maxTextures)), this.shader = ud;
		}
		packAttributes(e, t, n, r, i) {
			let a = i << 16 | e.roundPixels & 65535, o = e.transform, s = o.a, c = o.b, l = o.c, u = o.d, d = o.tx, f = o.ty, { positions: p, uvs: m } = e, h = e.color, g = e.attributeOffset, _ = g + e.attributeSize;
			for (let e = g; e < _; e++) {
				let i = e * 2, o = p[i], g = p[i + 1];
				t[r++] = s * o + l * g + d, t[r++] = u * g + c * o + f, t[r++] = m[i], t[r++] = m[i + 1], n[r++] = h, n[r++] = a;
			}
		}
		packQuadAttributes(e, t, n, r, i) {
			let a = e.texture, o = e.transform, s = o.a, c = o.b, l = o.c, u = o.d, d = o.tx, f = o.ty, p = e.bounds, m = p.maxX, h = p.minX, g = p.maxY, _ = p.minY, v = a.uvs, y = e.color, b = i << 16 | e.roundPixels & 65535;
			t[r + 0] = s * h + l * _ + d, t[r + 1] = u * _ + c * h + f, t[r + 2] = v.x0, t[r + 3] = v.y0, n[r + 4] = y, n[r + 5] = b, t[r + 6] = s * m + l * _ + d, t[r + 7] = u * _ + c * m + f, t[r + 8] = v.x1, t[r + 9] = v.y1, n[r + 10] = y, n[r + 11] = b, t[r + 12] = s * m + l * g + d, t[r + 13] = u * g + c * m + f, t[r + 14] = v.x2, t[r + 15] = v.y2, n[r + 16] = y, n[r + 17] = b, t[r + 18] = s * h + l * g + d, t[r + 19] = u * g + c * h + f, t[r + 20] = v.x3, t[r + 21] = v.y3, n[r + 22] = y, n[r + 23] = b;
		}
		_updateMaxTextures(e) {
			this.shader.maxTextures !== e && (ud = new cd(e), this.shader = ud);
		}
		destroy() {
			this.shader = null, super.destroy();
		}
	}, dd.extension = {
		type: [f.Batcher],
		name: "default"
	}, fd = dd;
})), md, hd, gd = o((() => {
	g(), Vo(), pd(), md = class e {
		constructor(e, t) {
			this.state = Bo.for2d(), this._batchersByInstructionSet = /* @__PURE__ */ Object.create(null), this._activeBatches = /* @__PURE__ */ Object.create(null), this.renderer = e, this._adaptor = t, this._adaptor.init?.(this);
		}
		static getBatcher(e) {
			return new this._availableBatchers[e]();
		}
		buildStart(e) {
			let t = this._batchersByInstructionSet[e.uid];
			t || (t = this._batchersByInstructionSet[e.uid] = /* @__PURE__ */ Object.create(null), t.default || (t.default = new fd({ maxTextures: this.renderer.limits.maxBatchableTextures }))), this._activeBatches = t, this._activeBatch = this._activeBatches.default;
			for (let e in this._activeBatches) this._activeBatches[e].begin();
		}
		addToBatch(t, n) {
			if (this._activeBatch.name !== t.batcherName) {
				this._activeBatch.break(n);
				let r = this._activeBatches[t.batcherName];
				r || (r = this._activeBatches[t.batcherName] = e.getBatcher(t.batcherName), r.begin()), this._activeBatch = r;
			}
			this._activeBatch.add(t);
		}
		break(e) {
			this._activeBatch.break(e);
		}
		buildEnd(e) {
			this._activeBatch.break(e);
			let t = this._activeBatches;
			for (let e in t) {
				let n = t[e], r = n.geometry;
				r.indexBuffer.setDataWithSize(n.indexBuffer, n.indexSize, !0), r.buffers[0].setDataWithSize(n.attributeBuffer.float32View, n.attributeSize, !1);
			}
		}
		upload(e) {
			let t = this._batchersByInstructionSet[e.uid];
			for (let e in t) {
				let n = t[e], r = n.geometry;
				n.dirty && (n.dirty = !1, r.buffers[0].update(n.attributeSize * 4));
			}
		}
		execute(e) {
			if (e.action === "startBatch") {
				let t = e.batcher, n = t.geometry, r = t.shader;
				this._adaptor.start(this, n, r);
			}
			this._adaptor.execute(this, e);
		}
		destroy() {
			this.state = null, this.renderer = null, this._adaptor = null;
			for (let e in this._activeBatches) this._activeBatches[e].destroy();
			this._activeBatches = null;
		}
	}, md.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "batch"
	}, md._availableBatchers = /* @__PURE__ */ Object.create(null), hd = md, h.handleByMap(f.Batcher, hd._availableBatchers), h.add(fd);
})), _d, vd = o((() => {
	_d = "in vec2 vMaskCoord;\nin vec2 vTextureCoord;\n\nuniform sampler2D uTexture;\nuniform sampler2D uMaskTexture;\n\nuniform float uAlpha;\nuniform vec4 uMaskClamp;\nuniform float uInverse;\n\nout vec4 finalColor;\n\nvoid main(void)\n{\n    float clip = step(3.5,\n        step(uMaskClamp.x, vMaskCoord.x) +\n        step(uMaskClamp.y, vMaskCoord.y) +\n        step(vMaskCoord.x, uMaskClamp.z) +\n        step(vMaskCoord.y, uMaskClamp.w));\n\n    // TODO look into why this is needed\n    float npmAlpha = uAlpha;\n    vec4 original = texture(uTexture, vTextureCoord);\n    vec4 masky = texture(uMaskTexture, vMaskCoord);\n    float alphaMul = 1.0 - npmAlpha * (1.0 - masky.a);\n\n    float a = alphaMul * masky.r * npmAlpha * clip;\n\n    if (uInverse == 1.0) {\n        a = 1.0 - a;\n    }\n\n    finalColor = original * a;\n}\n";
})), yd, bd = o((() => {
	yd = "in vec2 aPosition;\n\nout vec2 vTextureCoord;\nout vec2 vMaskCoord;\n\n\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\nuniform vec4 uOutputTexture;\nuniform mat3 uFilterMatrix;\n\nvec4 filterVertexPosition(  vec2 aPosition )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n       \n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nvec2 filterTextureCoord(  vec2 aPosition )\n{\n    return aPosition * (uOutputFrame.zw * uInputSize.zw);\n}\n\nvec2 getFilterCoord( vec2 aPosition )\n{\n    return  ( uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;\n}   \n\nvoid main(void)\n{\n    gl_Position = filterVertexPosition(aPosition);\n    vTextureCoord = filterTextureCoord(aPosition);\n    vMaskCoord = getFilterCoord(aPosition);\n}\n";
})), xd, Sd = o((() => {
	xd = "struct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct MaskUniforms {\n  uFilterMatrix:mat3x3<f32>,\n  uMaskClamp:vec4<f32>,\n  uAlpha:f32,\n  uInverse:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> filterUniforms : MaskUniforms;\n@group(1) @binding(1) var uMaskTexture: texture_2d<f32>;\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    @location(0) uv : vec2<f32>,\n    @location(1) filterUv : vec2<f32>,\n};\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);\n}\n\nfn getFilterCoord(aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return ( filterUniforms.uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;\n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>,\n) -> VSOutput {\n  return VSOutput(\n   filterVertexPosition(aPosition),\n   filterTextureCoord(aPosition),\n   getFilterCoord(aPosition)\n  );\n}\n\n@fragment\nfn mainFragment(\n  @location(0) uv: vec2<f32>,\n  @location(1) filterUv: vec2<f32>,\n  @builtin(position) position: vec4<f32>\n) -> @location(0) vec4<f32> {\n\n    var maskClamp = filterUniforms.uMaskClamp;\n    var uAlpha = filterUniforms.uAlpha;\n\n    var clip = step(3.5,\n      step(maskClamp.x, filterUv.x) +\n      step(maskClamp.y, filterUv.y) +\n      step(filterUv.x, maskClamp.z) +\n      step(filterUv.y, maskClamp.w));\n\n    var mask = textureSample(uMaskTexture, uSampler, filterUv);\n    var source = textureSample(uTexture, uSampler, uv);\n    var alphaMul = 1.0 - uAlpha * (1.0 - mask.a);\n\n    var a: f32 = alphaMul * mask.r * uAlpha * clip;\n\n    if (filterUniforms.uInverse == 1.0) {\n        a = 1.0 - a;\n    }\n\n    return source * a;\n}\n";
})), Cd, wd = o((() => {
	R(), Ja(), _o(), ko(), Tn(), Wo(), vd(), bd(), Sd(), Cd = class extends Uo {
		constructor(e) {
			let { sprite: t, ...n } = e, r = new wn(t.texture), i = new Oo({
				uFilterMatrix: {
					value: new L(),
					type: "mat3x3<f32>"
				},
				uMaskClamp: {
					value: r.uClampFrame,
					type: "vec4<f32>"
				},
				uAlpha: {
					value: 1,
					type: "f32"
				},
				uInverse: {
					value: e.inverse ? 1 : 0,
					type: "f32"
				}
			}), a = go.from({
				vertex: {
					source: xd,
					entryPoint: "mainVertex"
				},
				fragment: {
					source: xd,
					entryPoint: "mainFragment"
				}
			}), o = qa.from({
				vertex: yd,
				fragment: _d,
				name: "mask-filter"
			});
			super({
				...n,
				gpuProgram: a,
				glProgram: o,
				clipToViewport: !1,
				resources: {
					filterUniforms: i,
					uMaskTexture: t.texture.source
				}
			}), this.sprite = t, this._textureMatrix = r;
		}
		set inverse(e) {
			this.resources.filterUniforms.uniforms.uInverse = e ? 1 : 0;
		}
		get inverse() {
			return this.resources.filterUniforms.uniforms.uInverse === 1;
		}
		apply(e, t, n, r) {
			this._textureMatrix.texture = this.sprite.texture, e.calculateSpriteMatrix(this.resources.filterUniforms.uniforms.uFilterMatrix, this.sprite).prepend(this._textureMatrix.mapCoord), this.resources.uMaskTexture = this.sprite.texture.source, e.applyFilter(this, t, n, r);
		}
	};
})), Td, Ed, Dd, Od = o((() => {
	g(), nt(), wd(), mt(), wt(), Hi(), Ke(), q(), kn(), xo(), Td = new pt(), Ed = class extends tt {
		constructor() {
			super(), this.filters = [new Cd({
				sprite: new Vi(K.EMPTY),
				inverse: !1,
				resolution: "inherit",
				antialias: "inherit"
			})];
		}
		get sprite() {
			return this.filters[0].sprite;
		}
		set sprite(e) {
			this.filters[0].sprite = e;
		}
		get inverse() {
			return this.filters[0].inverse;
		}
		set inverse(e) {
			this.filters[0].inverse = e;
		}
	}, Dd = class {
		constructor(e) {
			this._activeMaskStage = [], this._renderer = e;
		}
		push(e, t, n) {
			let r = this._renderer;
			if (r.renderPipes.batch.break(n), n.add({
				renderPipeId: "alphaMask",
				action: "pushMaskBegin",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1,
				maskedContainer: t
			}), e.inverse = t._maskOptions.inverse, e.renderMaskToTexture) {
				let t = e.mask;
				t.includeInBuild = !0, t.collectRenderables(n, r, null), t.includeInBuild = !1;
			}
			r.renderPipes.batch.break(n), n.add({
				renderPipeId: "alphaMask",
				action: "pushMaskEnd",
				mask: e,
				maskedContainer: t,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
		}
		pop(e, t, n) {
			this._renderer.renderPipes.batch.break(n), n.add({
				renderPipeId: "alphaMask",
				action: "popMaskEnd",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
		}
		execute(e) {
			let t = this._renderer, n = e.mask.renderMaskToTexture;
			if (e.action === "pushMaskBegin") {
				let r = Ge.get(Ed);
				if (r.inverse = e.inverse, n) {
					e.mask.mask.measurable = !0;
					let n = xt(e.mask.mask, !0, Td);
					e.mask.mask.measurable = !1, n.ceil();
					let i = t.renderTarget.renderTarget.colorTexture.source, a = On.getOptimalTexture(n.width, n.height, i._resolution, i.antialias);
					t.renderTarget.push(a, !0), t.globalUniforms.push({
						offset: n,
						worldColor: 4294967295
					});
					let o = r.sprite;
					o.texture = a, o.worldTransform.tx = n.minX, o.worldTransform.ty = n.minY, this._activeMaskStage.push({
						filterEffect: r,
						maskedContainer: e.maskedContainer,
						filterTexture: a
					});
				} else r.sprite = e.mask.mask, this._activeMaskStage.push({
					filterEffect: r,
					maskedContainer: e.maskedContainer
				});
			} else if (e.action === "pushMaskEnd") {
				let e = this._activeMaskStage[this._activeMaskStage.length - 1];
				n && (t.type === bo.WEBGL && t.renderTarget.finishRenderPass(), t.renderTarget.pop(), t.globalUniforms.pop()), t.filter.push({
					renderPipeId: "filter",
					action: "pushFilter",
					container: e.maskedContainer,
					filterEffect: e.filterEffect,
					canBundle: !1
				});
			} else if (e.action === "popMaskEnd") {
				t.filter.pop();
				let e = this._activeMaskStage.pop();
				n && On.returnTexture(e.filterTexture), Ge.return(e.filterEffect);
			}
		}
		destroy() {
			this._renderer = null, this._activeMaskStage = null;
		}
	}, Dd.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "alphaMask"
	};
})), kd, Ad = o((() => {
	g(), kd = class {
		constructor(e) {
			this._colorStack = [], this._colorStackIndex = 0, this._currentColor = 0, this._renderer = e;
		}
		buildStart() {
			this._colorStack[0] = 15, this._colorStackIndex = 1, this._currentColor = 15;
		}
		push(e, t, n) {
			this._renderer.renderPipes.batch.break(n);
			let r = this._colorStack;
			r[this._colorStackIndex] = r[this._colorStackIndex - 1] & e.mask;
			let i = this._colorStack[this._colorStackIndex];
			i !== this._currentColor && (this._currentColor = i, n.add({
				renderPipeId: "colorMask",
				colorMask: i,
				canBundle: !1
			})), this._colorStackIndex++;
		}
		pop(e, t, n) {
			this._renderer.renderPipes.batch.break(n);
			let r = this._colorStack;
			this._colorStackIndex--;
			let i = r[this._colorStackIndex - 1];
			i !== this._currentColor && (this._currentColor = i, n.add({
				renderPipeId: "colorMask",
				colorMask: i,
				canBundle: !1
			}));
		}
		execute(e) {
			this._renderer.colorMask.setMask(e.colorMask);
		}
		destroy() {
			this._renderer = null, this._colorStack = null;
		}
	}, kd.extension = {
		type: [f.WebGLPipes, f.WebGPUPipes],
		name: "colorMask"
	};
})), jd, Md = o((() => {
	g(), Dc(), Pu(), jd = class {
		constructor(e) {
			this._maskStackHash = {}, this._maskHash = /* @__PURE__ */ new WeakMap(), this._renderer = e;
		}
		push(e, t, n) {
			var r;
			let i = e, a = this._renderer;
			a.renderPipes.batch.break(n), a.renderPipes.blendMode.setBlendMode(i.mask, "none", n), n.add({
				renderPipeId: "stencilMask",
				action: "pushMaskBegin",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
			let o = i.mask;
			o.includeInBuild = !0, this._maskHash.has(i) || this._maskHash.set(i, {
				instructionsStart: 0,
				instructionsLength: 0
			});
			let s = this._maskHash.get(i);
			s.instructionsStart = n.instructionSize, o.collectRenderables(n, a, null), o.includeInBuild = !1, a.renderPipes.batch.break(n), n.add({
				renderPipeId: "stencilMask",
				action: "pushMaskEnd",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			}), s.instructionsLength = n.instructionSize - s.instructionsStart - 1;
			let c = a.renderTarget.renderTarget.uid;
			(r = this._maskStackHash)[c] ?? (r[c] = 0);
		}
		pop(e, t, n) {
			let r = e, i = this._renderer;
			i.renderPipes.batch.break(n), i.renderPipes.blendMode.setBlendMode(r.mask, "none", n), n.add({
				renderPipeId: "stencilMask",
				action: "popMaskBegin",
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
			let a = this._maskHash.get(e);
			for (let e = 0; e < a.instructionsLength; e++) n.instructions[n.instructionSize++] = n.instructions[a.instructionsStart++];
			n.add({
				renderPipeId: "stencilMask",
				action: "popMaskEnd",
				canBundle: !1
			});
		}
		execute(e) {
			var t;
			let n = this._renderer, r = n, i = n.renderTarget.renderTarget.uid, a = (t = this._maskStackHash)[i] ?? (t[i] = 0);
			e.action === "pushMaskBegin" ? (r.renderTarget.ensureDepthStencil(), r.stencil.setStencilMode(Nu.RENDERING_MASK_ADD, a), a++, r.colorMask.setMask(0)) : e.action === "pushMaskEnd" ? (e.inverse ? r.stencil.setStencilMode(Nu.INVERSE_MASK_ACTIVE, a) : r.stencil.setStencilMode(Nu.MASK_ACTIVE, a), r.colorMask.setMask(15)) : e.action === "popMaskBegin" ? (r.colorMask.setMask(0), a === 0 ? (r.renderTarget.clear(null, Ec.STENCIL), r.stencil.setStencilMode(Nu.DISABLED, a)) : r.stencil.setStencilMode(Nu.RENDERING_MASK_REMOVE, a), a--) : e.action === "popMaskEnd" && (e.inverse ? r.stencil.setStencilMode(Nu.INVERSE_MASK_ACTIVE, a) : r.stencil.setStencilMode(Nu.MASK_ACTIVE, a), r.colorMask.setMask(15)), this._maskStackHash[i] = a;
		}
		destroy() {
			this._renderer = null, this._maskStackHash = null, this._maskHash = null;
		}
	}, jd.extension = {
		type: [f.WebGLPipes, f.WebGPUPipes],
		name: "stencilMask"
	};
})), Nd, Pd, Fd = o((() => {
	ye(), g(), U(), Nd = class e {
		constructor() {
			this.clearBeforeRender = !0, this._backgroundColor = new F(0), this.color = this._backgroundColor, this.alpha = 1;
		}
		init(t) {
			t = {
				...e.defaultOptions,
				...t
			}, this.clearBeforeRender = t.clearBeforeRender, this.color = t.background || t.backgroundColor || this._backgroundColor, this.alpha = t.backgroundAlpha, this._backgroundColor.setAlpha(t.backgroundAlpha);
		}
		get color() {
			return this._backgroundColor;
		}
		set color(e) {
			F.shared.setValue(e).alpha < 1 && this._backgroundColor.alpha === 1 && H("Cannot set a transparent background on an opaque canvas. To enable transparency, set backgroundAlpha < 1 when initializing your Application."), this._backgroundColor.setValue(e);
		}
		get alpha() {
			return this._backgroundColor.alpha;
		}
		set alpha(e) {
			this._backgroundColor.setAlpha(e);
		}
		get colorRgba() {
			return this._backgroundColor.toArray();
		}
		destroy() {}
	}, Nd.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "background",
		priority: 0
	}, Nd.defaultOptions = {
		backgroundAlpha: 1,
		backgroundColor: 0,
		clearBeforeRender: !0
	}, Pd = Nd;
})), Id, Ld, Rd = o((() => {
	g(), nt(), jn(), U(), Id = {}, h.handle(f.BlendMode, (e) => {
		if (!e.name) throw Error("BlendMode extension must have a name property");
		Id[e.name] = e.ref;
	}, (e) => {
		delete Id[e.name];
	}), Ld = class {
		constructor(e) {
			this._blendModeStack = [], this._isAdvanced = !1, this._filterHash = /* @__PURE__ */ Object.create(null), this._renderer = e, this._renderer.runners.prerender.add(this);
		}
		prerender() {
			this._activeBlendMode = "normal", this._isAdvanced = !1;
		}
		pushBlendMode(e, t, n) {
			this._blendModeStack.push(t), this.setBlendMode(e, t, n);
		}
		popBlendMode(e) {
			this._blendModeStack.pop();
			let t = this._blendModeStack[this._activeBlendMode.length - 1] ?? "normal";
			this.setBlendMode(null, t, e);
		}
		setBlendMode(e, t, n) {
			let r = e instanceof An;
			if (this._activeBlendMode === t) {
				this._isAdvanced && e && !r && this._renderableList?.push(e);
				return;
			}
			this._isAdvanced && this._endAdvancedBlendMode(n), this._activeBlendMode = t, e && (this._isAdvanced = !!Id[t], this._isAdvanced && this._beginAdvancedBlendMode(e, n));
		}
		_beginAdvancedBlendMode(e, t) {
			this._renderer.renderPipes.batch.break(t);
			let n = this._activeBlendMode;
			if (!Id[n]) {
				H(`Unable to assign BlendMode: '${n}'. You may want to include: import 'pixi.js/advanced-blend-modes'`);
				return;
			}
			let r = this._ensureFilterEffect(n), i = e instanceof An, a = {
				renderPipeId: "filter",
				action: "pushFilter",
				filterEffect: r,
				renderables: i ? null : [e],
				container: i ? e.root : null,
				canBundle: !1
			};
			this._renderableList = a.renderables, t.add(a);
		}
		_ensureFilterEffect(e) {
			let t = this._filterHash[e];
			return t || (t = this._filterHash[e] = new tt(), t.filters = [new Id[e]()]), t;
		}
		_endAdvancedBlendMode(e) {
			this._isAdvanced = !1, this._renderableList = null, this._renderer.renderPipes.batch.break(e), e.add({
				renderPipeId: "filter",
				action: "popFilter",
				canBundle: !1
			});
		}
		buildStart() {
			this._isAdvanced = !1;
		}
		buildEnd(e) {
			this._isAdvanced && this._endAdvancedBlendMode(e);
		}
		destroy() {
			this._renderer = null, this._renderableList = null;
			for (let e in this._filterHash) this._filterHash[e].destroy();
			this._filterHash = null;
		}
	}, Ld.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "blendMode"
	};
})), zd, Bd, Vd, Hd = o((() => {
	Y(), g(), zn(), q(), zd = {
		png: "image/png",
		jpg: "image/jpeg",
		webp: "image/webp"
	}, Bd = class e {
		constructor(e) {
			this._renderer = e;
		}
		_normalizeOptions(e, t = {}) {
			return e instanceof Rn || e instanceof K ? {
				target: e,
				...t
			} : {
				...t,
				...e
			};
		}
		async image(e) {
			let t = J.get().createImage();
			return t.src = await this.base64(e), t;
		}
		async base64(t) {
			t = this._normalizeOptions(t, e.defaultImageOptions);
			let { format: n, quality: r } = t, i = this.canvas(t);
			if (i.toBlob !== void 0) return new Promise((e, t) => {
				i.toBlob((n) => {
					if (!n) {
						t(/* @__PURE__ */ Error("ICanvas.toBlob failed!"));
						return;
					}
					let r = new FileReader();
					r.onload = () => e(r.result), r.onerror = t, r.readAsDataURL(n);
				}, zd[n], r);
			});
			if (i.toDataURL !== void 0) return i.toDataURL(zd[n], r);
			if (i.convertToBlob !== void 0) {
				let e = await i.convertToBlob({
					type: zd[n],
					quality: r
				});
				return new Promise((t, n) => {
					let r = new FileReader();
					r.onload = () => t(r.result), r.onerror = n, r.readAsDataURL(e);
				});
			}
			throw Error("Extract.base64() requires ICanvas.toDataURL, ICanvas.toBlob, or ICanvas.convertToBlob to be implemented");
		}
		canvas(e) {
			e = this._normalizeOptions(e);
			let t = e.target, n = this._renderer;
			if (t instanceof K) return n.texture.generateCanvas(t);
			let r = n.textureGenerator.generateTexture(e), i = n.texture.generateCanvas(r);
			return r.destroy(!0), i;
		}
		pixels(e) {
			e = this._normalizeOptions(e);
			let t = e.target, n = this._renderer, r = t instanceof K ? t : n.textureGenerator.generateTexture(e), i = n.texture.getPixels(r);
			return t instanceof Rn && r.destroy(!0), i;
		}
		texture(e) {
			return e = this._normalizeOptions(e), e.target instanceof K ? e.target : this._renderer.textureGenerator.generateTexture(e);
		}
		download(e) {
			e = this._normalizeOptions(e);
			let t = this.canvas(e), n = document.createElement("a");
			n.download = e.filename ?? "image.png", n.href = t.toDataURL("image/png"), document.body.appendChild(n), n.click(), document.body.removeChild(n);
		}
		log(e) {
			let t = e.width ?? 200;
			e = this._normalizeOptions(e);
			let n = this.canvas(e), r = n.toDataURL();
			console.log(`[Pixi Texture] ${n.width}px ${n.height}px`);
			let i = [
				"font-size: 1px;",
				`padding: ${t}px 300px;`,
				`background: url(${r}) no-repeat;`,
				"background-size: contain;"
			].join(" ");
			console.log("%c ", i);
		}
		destroy() {
			this._renderer = null;
		}
	}, Bd.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "extract"
	}, Bd.defaultImageOptions = {
		format: "png",
		quality: 1
	}, Vd = Bd;
})), Ud, Wd = o((() => {
	ln(), q(), Ud = class e extends K {
		static create(t) {
			let { dynamic: n, ...r } = t;
			return new e({
				source: new cn(r),
				dynamic: n ?? !1
			});
		}
		resize(e, t, n) {
			return this.source.resize(e, t, n), this;
		}
	};
})), Gd, Kd, qd, Jd, Yd = o((() => {
	ye(), g(), R(), dt(), mt(), Ft(), zn(), Wd(), Gd = new W(), Kd = new pt(), qd = [
		0,
		0,
		0,
		0
	], Jd = class {
		constructor(e) {
			this._renderer = e;
		}
		generateTexture(e) {
			e instanceof Rn && (e = {
				target: e,
				frame: void 0,
				textureSourceOptions: {},
				resolution: void 0
			});
			let t = e.resolution || this._renderer.resolution, n = e.antialias || this._renderer.view.antialias, r = e.target, i = e.clearColor;
			i = i ? Array.isArray(i) && i.length === 4 ? i : F.shared.setValue(i).toArray() : qd;
			let a = e.frame?.copyTo(Gd) || Nt(r, Kd).rectangle;
			a.width = Math.max(a.width, 1 / t) | 0, a.height = Math.max(a.height, 1 / t) | 0;
			let o = Ud.create({
				...e.textureSourceOptions,
				width: a.width,
				height: a.height,
				resolution: t,
				antialias: n
			}), s = L.shared.translate(-a.x, -a.y);
			return this._renderer.render({
				container: r,
				transform: s,
				target: o,
				clearColor: i
			}), o.source.updateMipmaps(), o;
		}
		destroy() {
			this._renderer = null;
		}
	}, Jd.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "textureGenerator"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/data/clean.mjs
function Xd(e) {
	let t = !1;
	for (let n in e) if (e[n] == null) {
		t = !0;
		break;
	}
	if (!t) return e;
	let n = /* @__PURE__ */ Object.create(null);
	for (let t in e) {
		let r = e[t];
		r && (n[t] = r);
	}
	return n;
}
function Zd(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e[n] == null ? t++ : e[n - t] = e[n];
	return e.length -= t, e;
}
var Qd = o((() => {})), $d, ef, tf = o((() => {
	g(), Qd(), $d = class e {
		constructor(e) {
			this._managedResources = [], this._managedResourceHashes = [], this._managedCollections = [], this._ready = !1, this._renderer = e;
		}
		init(t) {
			t = {
				...e.defaultOptions,
				...t
			}, this.maxUnusedTime = t.gcMaxUnusedTime, this._frequency = t.gcFrequency, this.enabled = t.gcActive, this.now = performance.now();
		}
		get enabled() {
			return !!this._handler;
		}
		set enabled(e) {
			this.enabled !== e && (e ? (this._handler = this._renderer.scheduler.repeat(() => {
				this._ready = !0;
			}, this._frequency, !1), this._collectionsHandler = this._renderer.scheduler.repeat(() => {
				for (let e of this._managedCollections) {
					let { context: t, collection: n, type: r } = e;
					r === "hash" ? t[n] = Xd(t[n]) : t[n] = Zd(t[n]);
				}
			}, this._frequency)) : (this._renderer.scheduler.cancel(this._handler), this._renderer.scheduler.cancel(this._collectionsHandler), this._handler = 0, this._collectionsHandler = 0));
		}
		prerender({ container: e }) {
			this.now = performance.now(), e.renderGroup.gcTick = this._renderer.tick++, this._updateInstructionGCTick(e.renderGroup, e.renderGroup.gcTick);
		}
		postrender() {
			!this._ready || !this.enabled || (this.run(), this._ready = !1);
		}
		_updateInstructionGCTick(e, t) {
			e.instructionSet.gcTick = t, e.gcTick = t;
			for (let n of e.renderGroupChildren) this._updateInstructionGCTick(n, t);
		}
		addCollection(e, t, n) {
			this._managedCollections.push({
				context: e,
				collection: t,
				type: n
			});
		}
		addResource(e, t) {
			if (e._gcLastUsed !== -1) {
				e._gcLastUsed = this.now, e._onTouch?.(this.now);
				return;
			}
			e._gcData = {
				index: this._managedResources.length,
				type: t
			}, e._gcLastUsed = this.now, e._onTouch?.(this.now), e.once("unload", this.removeResource, this), this._managedResources.push(e);
		}
		removeResource(e) {
			let t = e._gcData;
			if (!t) return;
			let n = t.index, r = this._managedResources.length - 1;
			if (n !== r) {
				let e = this._managedResources[r];
				this._managedResources[n] = e, e._gcData.index = n;
			}
			this._managedResources.length--, e._gcData = null, e._gcLastUsed = -1;
		}
		addResourceHash(e, t, n, r = 0) {
			this._managedResourceHashes.push({
				context: e,
				hash: t,
				type: n,
				priority: r
			}), this._managedResourceHashes.sort((e, t) => e.priority - t.priority);
		}
		run() {
			let e = performance.now(), t = this._managedResourceHashes;
			for (let n of t) this.runOnHash(n, e);
			let n = 0;
			for (let t = 0; t < this._managedResources.length; t++) {
				let r = this._managedResources[t];
				n = this.runOnResource(r, e, n);
			}
			this._managedResources.length = n;
		}
		updateRenderableGCTick(e, t) {
			let n = e.renderGroup ?? e.parentRenderGroup, r = n?.instructionSet?.gcTick ?? -1;
			(n?.gcTick ?? 0) === r && (e._gcLastUsed = t, e._onTouch?.(t));
		}
		runOnResource(e, t, n) {
			let r = e._gcData;
			return r.type === "renderable" && this.updateRenderableGCTick(e, t), t - e._gcLastUsed < this.maxUnusedTime || !e.autoGarbageCollect ? (this._managedResources[n] = e, r.index = n, n++) : (e.unload(), e._gcData = null, e._gcLastUsed = -1, e.off("unload", this.removeResource, this)), n;
		}
		_createHashClone(e, t) {
			let n = /* @__PURE__ */ Object.create(null);
			for (let r in e) {
				if (r === t) break;
				e[r] !== null && (n[r] = e[r]);
			}
			return n;
		}
		runOnHash(e, t) {
			let { context: n, hash: r, type: i } = e, a = n[r], o = null, s = 0;
			for (let e in a) {
				let n = a[e];
				if (n === null) {
					s++, s === 1e4 && !o && (o = this._createHashClone(a, e));
					continue;
				}
				if (n._gcLastUsed === -1) {
					n._gcLastUsed = t, n._onTouch?.(t), o && (o[e] = n);
					continue;
				}
				if (i === "renderable" && this.updateRenderableGCTick(n, t), !(t - n._gcLastUsed < this.maxUnusedTime) && n.autoGarbageCollect) {
					if (o || (s + 1 === 1e4 ? o = this._createHashClone(a, e) : (a[e] = null, s++)), i === "renderable") {
						let e = n, t = e.renderGroup ?? e.parentRenderGroup;
						t && (t.structureDidChange = !0);
					}
					n.unload(), n._gcData = null, n._gcLastUsed = -1;
				} else o && (o[e] = n);
			}
			o && (n[r] = o);
		}
		destroy() {
			this.enabled = !1, this._managedResources.forEach((e) => {
				e.off("unload", this.removeResource, this);
			}), this._managedResources.length = 0, this._managedResourceHashes.length = 0, this._managedCollections.length = 0, this._renderer = null;
		}
	}, $d.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "gc",
		priority: 0
	}, $d.defaultOptions = {
		gcActive: !0,
		gcMaxUnusedTime: 6e4,
		gcFrequency: 3e4
	}, ef = $d;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/gpu/colorToUniform.mjs
function nf(e, t, n) {
	let r = (e >> 24 & 255) / 255;
	t[n++] = (e & 255) / 255 * r, t[n++] = (e >> 8 & 255) / 255 * r, t[n++] = (e >> 16 & 255) / 255 * r, t[n++] = r;
}
var rf = o((() => {})), af, of = o((() => {
	g(), R(), De(), rf(), yo(), xo(), ko(), af = class {
		constructor(e) {
			this._stackIndex = 0, this._globalUniformDataStack = [], this._uniformsPool = [], this._activeUniforms = [], this._bindGroupPool = [], this._activeBindGroups = [], this._renderer = e;
		}
		reset() {
			this._stackIndex = 0;
			for (let e = 0; e < this._activeUniforms.length; e++) this._uniformsPool.push(this._activeUniforms[e]);
			for (let e = 0; e < this._activeBindGroups.length; e++) this._bindGroupPool.push(this._activeBindGroups[e]);
			this._activeUniforms.length = 0, this._activeBindGroups.length = 0;
		}
		start(e) {
			this.reset(), this.push(e);
		}
		bind({ size: e, projectionMatrix: t, worldTransformMatrix: n, worldColor: r, offset: i }) {
			let a = this._renderer.renderTarget.renderTarget, o = this._stackIndex ? this._globalUniformDataStack[this._stackIndex - 1] : {
				projectionData: a,
				worldTransformMatrix: new L(),
				worldColor: 4294967295,
				offset: new I()
			}, s = {
				projectionMatrix: t || this._renderer.renderTarget.projectionMatrix,
				resolution: e || a.size,
				worldTransformMatrix: n || o.worldTransformMatrix,
				worldColor: r || o.worldColor,
				offset: i || o.offset,
				bindGroup: null
			}, c = this._uniformsPool.pop() || this._createUniforms();
			this._activeUniforms.push(c);
			let l = c.uniforms;
			l.uProjectionMatrix = s.projectionMatrix, l.uResolution = s.resolution, l.uWorldTransformMatrix.copyFrom(s.worldTransformMatrix), l.uWorldTransformMatrix.tx -= s.offset.x, l.uWorldTransformMatrix.ty -= s.offset.y, nf(s.worldColor, l.uWorldColorAlpha, 0), c.update();
			let u;
			this._renderer.renderPipes.uniformBatch ? u = this._renderer.renderPipes.uniformBatch.getUniformBindGroup(c, !1) : (u = this._bindGroupPool.pop() || new vo(), this._activeBindGroups.push(u), u.setResource(c, 0)), s.bindGroup = u, this._currentGlobalUniformData = s;
		}
		push(e) {
			this.bind(e), this._globalUniformDataStack[this._stackIndex++] = this._currentGlobalUniformData;
		}
		pop() {
			this._currentGlobalUniformData = this._globalUniformDataStack[--this._stackIndex - 1], this._renderer.type === bo.WEBGL && this._currentGlobalUniformData.bindGroup.resources[0].update();
		}
		get bindGroup() {
			return this._currentGlobalUniformData.bindGroup;
		}
		get globalUniformData() {
			return this._currentGlobalUniformData;
		}
		get uniformGroup() {
			return this._currentGlobalUniformData.bindGroup.resources[0];
		}
		_createUniforms() {
			return new Oo({
				uProjectionMatrix: {
					value: new L(),
					type: "mat3x3<f32>"
				},
				uWorldTransformMatrix: {
					value: new L(),
					type: "mat3x3<f32>"
				},
				uWorldColorAlpha: {
					value: new Float32Array(4),
					type: "vec4<f32>"
				},
				uResolution: {
					value: [0, 0],
					type: "vec2<f32>"
				}
			}, { isStatic: !0 });
		}
		destroy() {
			this._renderer = null, this._globalUniformDataStack.length = 0, this._uniformsPool.length = 0, this._activeUniforms.length = 0, this._bindGroupPool.length = 0, this._activeBindGroups.length = 0, this._currentGlobalUniformData = null;
		}
	}, af.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "globalUniforms"
	};
})), sf, cf, lf = o((() => {
	g(), Kn(), sf = 1, cf = class {
		constructor() {
			this._tasks = [], this._offset = 0;
		}
		init() {
			Gn.system.add(this._update, this);
		}
		repeat(e, t, n = !0) {
			let r = sf++, i = 0;
			return n && (this._offset += 1e3, i = this._offset), this._tasks.push({
				func: e,
				duration: t,
				start: performance.now(),
				offset: i,
				last: performance.now(),
				repeat: !0,
				id: r
			}), r;
		}
		cancel(e) {
			for (let t = 0; t < this._tasks.length; t++) if (this._tasks[t].id === e) {
				this._tasks.splice(t, 1);
				return;
			}
		}
		_update() {
			let e = performance.now();
			for (let t = 0; t < this._tasks.length; t++) {
				let n = this._tasks[t];
				if (e - n.offset - n.last >= n.duration) {
					let t = e - n.start;
					n.func(t), n.last = e;
				}
			}
		}
		destroy() {
			Gn.system.remove(this._update, this), this._tasks.length = 0;
		}
	}, cf.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "scheduler",
		priority: 0
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/sayHello.mjs
function uf(e) {
	if (!df) {
		if (J.get().getNavigator().userAgent.toLowerCase().indexOf("chrome") > -1) {
			let t = [
				`%c  %c  %c  %c  %c PixiJS %c v${Cu} (${e}) http://www.pixijs.com/

`,
				"background: #E72264; padding:5px 0;",
				"background: #6CA2EA; padding:5px 0;",
				"background: #B5D33D; padding:5px 0;",
				"background: #FED23F; padding:5px 0;",
				"color: #FFFFFF; background: #E72264; padding:5px 0;",
				"color: #E72264; background: #FFFFFF; padding:5px 0;"
			];
			globalThis.console.log(...t);
		} else globalThis.console && globalThis.console.log(`PixiJS ${Cu} - ${e} - http://www.pixijs.com/`);
		df = !0;
	}
}
var df, ff = o((() => {
	Y(), wu(), df = !1;
})), pf, mf = o((() => {
	g(), ff(), xo(), pf = class {
		constructor(e) {
			this._renderer = e;
		}
		init(e) {
			if (e.hello) {
				let e = this._renderer.name;
				this._renderer.type === bo.WEBGL && (e += ` ${this._renderer.context.webGLVersion}`), uf(e);
			}
		}
	}, pf.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "hello",
		priority: -2
	}, pf.defaultOptions = { hello: !1 };
})), hf, gf, _f = o((() => {
	g(), Le(), hf = class e {
		constructor(e) {
			this._renderer = e;
		}
		init(t) {
			t = {
				...e.defaultOptions,
				...t
			}, this.maxUnusedTime = t.renderableGCMaxUnusedTime;
		}
		get enabled() {
			return V("8.15.0", "RenderableGCSystem.enabled is deprecated, please use the GCSystem.enabled instead."), this._renderer.gc.enabled;
		}
		set enabled(e) {
			V("8.15.0", "RenderableGCSystem.enabled is deprecated, please use the GCSystem.enabled instead."), this._renderer.gc.enabled = e;
		}
		addManagedHash(e, t) {
			V("8.15.0", "RenderableGCSystem.addManagedHash is deprecated, please use the GCSystem.addCollection instead."), this._renderer.gc.addCollection(e, t, "hash");
		}
		addManagedArray(e, t) {
			V("8.15.0", "RenderableGCSystem.addManagedArray is deprecated, please use the GCSystem.addCollection instead."), this._renderer.gc.addCollection(e, t, "array");
		}
		addRenderable(e) {
			V("8.15.0", "RenderableGCSystem.addRenderable is deprecated, please use the GCSystem instead."), this._renderer.gc.addResource(e, "renderable");
		}
		run() {
			V("8.15.0", "RenderableGCSystem.run is deprecated, please use the GCSystem instead."), this._renderer.gc.run();
		}
		destroy() {
			this._renderer = null;
		}
	}, hf.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "renderableGC",
		priority: 0
	}, hf.defaultOptions = {
		renderableGCActive: !0,
		renderableGCMaxUnusedTime: 6e4,
		renderableGCFrequency: 3e4
	}, gf = hf;
})), vf, yf, bf = o((() => {
	g(), Le(), vf = class e {
		get count() {
			return this._renderer.tick;
		}
		get checkCount() {
			return this._checkCount;
		}
		set checkCount(e) {
			V("8.15.0", "TextureGCSystem.run is deprecated, please use the GCSystem instead."), this._checkCount = e;
		}
		get maxIdle() {
			return this._renderer.gc.maxUnusedTime / 1e3 * 60;
		}
		set maxIdle(e) {
			V("8.15.0", "TextureGCSystem.run is deprecated, please use the GCSystem instead."), this._renderer.gc.maxUnusedTime = e / 60 * 1e3;
		}
		get checkCountMax() {
			return Math.floor(this._renderer.gc._frequency / 1e3);
		}
		set checkCountMax(e) {
			V("8.15.0", "TextureGCSystem.run is deprecated, please use the GCSystem instead.");
		}
		get active() {
			return this._renderer.gc.enabled;
		}
		set active(e) {
			V("8.15.0", "TextureGCSystem.run is deprecated, please use the GCSystem instead."), this._renderer.gc.enabled = e;
		}
		constructor(e) {
			this._renderer = e, this._checkCount = 0;
		}
		init(t) {
			t.textureGCActive !== e.defaultOptions.textureGCActive && (this.active = t.textureGCActive), t.textureGCMaxIdle !== e.defaultOptions.textureGCMaxIdle && (this.maxIdle = t.textureGCMaxIdle), t.textureGCCheckCountMax !== e.defaultOptions.textureGCCheckCountMax && (this.checkCountMax = t.textureGCCheckCountMax);
		}
		run() {
			V("8.15.0", "TextureGCSystem.run is deprecated, please use the GCSystem instead."), this._renderer.gc.run();
		}
		destroy() {
			this._renderer = null;
		}
	}, vf.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "textureGC"
	}, vf.defaultOptions = {
		textureGCActive: !0,
		textureGCAMaxIdle: null,
		textureGCMaxIdle: 3600,
		textureGCCheckCountMax: 600
	}, yf = vf;
})), xf, Sf, Cf = o((() => {
	Ne(), ln(), q(), xf = class e {
		constructor(t = {}) {
			if (this.uid = z("renderTarget"), this.colorTextures = [], this.dirtyId = 0, this.isRoot = !1, this._size = new Float32Array(2), this._managedColorTextures = !1, t = {
				...e.defaultOptions,
				...t
			}, this.stencil = t.stencil, this.depth = t.depth, this.isRoot = t.isRoot, typeof t.colorTextures == "number") {
				this._managedColorTextures = !0;
				for (let e = 0; e < t.colorTextures; e++) this.colorTextures.push(new cn({
					width: t.width,
					height: t.height,
					resolution: t.resolution,
					antialias: t.antialias
				}));
			} else {
				this.colorTextures = [...t.colorTextures.map((e) => e.source)];
				let e = this.colorTexture.source;
				this.resize(e.width, e.height, e._resolution);
			}
			this.colorTexture.source.on("resize", this.onSourceResize, this), (t.depthStencilTexture || this.stencil) && (t.depthStencilTexture instanceof K || t.depthStencilTexture instanceof cn ? this.depthStencilTexture = t.depthStencilTexture.source : this.ensureDepthStencilTexture());
		}
		get size() {
			let e = this._size;
			return e[0] = this.pixelWidth, e[1] = this.pixelHeight, e;
		}
		get width() {
			return this.colorTexture.source.width;
		}
		get height() {
			return this.colorTexture.source.height;
		}
		get pixelWidth() {
			return this.colorTexture.source.pixelWidth;
		}
		get pixelHeight() {
			return this.colorTexture.source.pixelHeight;
		}
		get resolution() {
			return this.colorTexture.source._resolution;
		}
		get colorTexture() {
			return this.colorTextures[0];
		}
		onSourceResize(e) {
			this.resize(e.width, e.height, e._resolution, !0);
		}
		ensureDepthStencilTexture() {
			this.depthStencilTexture || (this.depthStencilTexture = new cn({
				width: this.width,
				height: this.height,
				resolution: this.resolution,
				format: "depth24plus-stencil8",
				autoGenerateMipmaps: !1,
				antialias: !1,
				mipLevelCount: 1
			}));
		}
		resize(e, t, n = this.resolution, r = !1) {
			this.dirtyId++, this.colorTextures.forEach((i, a) => {
				r && a === 0 || i.source.resize(e, t, n);
			}), this.depthStencilTexture && this.depthStencilTexture.source.resize(e, t, n);
		}
		destroy() {
			this.colorTexture.source.off("resize", this.onSourceResize, this), this._managedColorTextures && this.colorTextures.forEach((e) => {
				e.destroy();
			}), this.depthStencilTexture && (this.depthStencilTexture.destroy(), delete this.depthStencilTexture);
		}
	}, xf.defaultOptions = {
		width: 0,
		height: 0,
		resolution: 1,
		colorTextures: 1,
		stencil: !1,
		depth: !1,
		antialias: !1,
		isRoot: !1
	}, Sf = xf;
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/texture/utils/getCanvasTexture.mjs
function wf(e, t) {
	if (!Tf.has(e)) {
		let n = new K({ source: new ta({
			resource: e,
			...t
		}) }), r = () => {
			Tf.get(e) === n && Tf.delete(e);
		};
		n.once("destroy", r), n.source.once("destroy", r), Tf.set(e, n);
	}
	return Tf.get(e);
}
var Tf, Ef = o((() => {
	Ve(), na(), q(), Tf = /* @__PURE__ */ new Map(), Be.register(Tf);
})), Df, Of, kf = o((() => {
	Y(), g(), dt(), Le(), Cf(), Ef(), Df = class e {
		get autoDensity() {
			return this.texture.source.autoDensity;
		}
		set autoDensity(e) {
			this.texture.source.autoDensity = e;
		}
		get resolution() {
			return this.texture.source._resolution;
		}
		set resolution(e) {
			this.texture.source.resize(this.texture.source.width, this.texture.source.height, e);
		}
		init(t) {
			t = {
				...e.defaultOptions,
				...t
			}, t.view && (V(B, "ViewSystem.view has been renamed to ViewSystem.canvas"), t.canvas = t.view), this.screen = new W(0, 0, t.width, t.height), this.canvas = t.canvas || J.get().createCanvas(), this.antialias = !!t.antialias, this.texture = wf(this.canvas, t), this.renderTarget = new Sf({
				colorTextures: [this.texture],
				depth: !!t.depth,
				isRoot: !0
			}), this.texture.source.transparent = t.backgroundAlpha < 1, this.resolution = t.resolution;
		}
		resize(e, t, n) {
			this.texture.source.resize(e, t, n), this.screen.width = this.texture.frame.width, this.screen.height = this.texture.frame.height;
		}
		destroy(e = !1) {
			(typeof e == "boolean" ? e : e?.removeView) && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas), this.texture.destroy();
		}
	}, Df.extension = {
		type: [
			f.WebGLSystem,
			f.WebGPUSystem,
			f.CanvasSystem
		],
		name: "view",
		priority: 0
	}, Df.defaultOptions = {
		width: 800,
		height: 600,
		autoDensity: !1,
		antialias: !1
	}, Of = Df;
})), Af, jf, Mf = o((() => {
	eu(), ou(), bu(), Su(), Du(), gd(), Od(), Ad(), Md(), Fd(), Rd(), Hd(), Yd(), tf(), of(), lf(), mf(), _f(), bf(), kf(), Af = [
		Pd,
		af,
		pf,
		Of,
		yu,
		ef,
		yf,
		Jd,
		Vd,
		Eu,
		gf,
		cf
	], jf = [
		Ld,
		hd,
		xu,
		au,
		Dd,
		jd,
		kd,
		$l
	];
})), Nf, Pf = o((() => {
	g(), Nf = class {
		constructor(e) {
			this._hash = /* @__PURE__ */ Object.create(null), this._renderer = e;
		}
		contextChange(e) {
			this._gpu = e;
		}
		getBindGroup(e, t, n) {
			return e._updateKey(), this._hash[e._key] || this._createBindGroup(e, t, n);
		}
		_createBindGroup(e, t, n) {
			let r = this._gpu.device, i = t.layout[n], a = [], o = this._renderer;
			for (let t in i) {
				let n = e.resources[t] ?? e.resources[i[t]], r;
				if (n._resourceType === "uniformGroup") {
					let e = n;
					o.ubo.updateUniformGroup(e);
					let t = e.buffer;
					r = {
						buffer: o.buffer.getGPUBuffer(t),
						offset: 0,
						size: t.descriptor.size
					};
				} else if (n._resourceType === "buffer") {
					let e = n;
					r = {
						buffer: o.buffer.getGPUBuffer(e),
						offset: 0,
						size: e.descriptor.size
					};
				} else if (n._resourceType === "bufferResource") {
					let e = n;
					r = {
						buffer: o.buffer.getGPUBuffer(e.buffer),
						offset: e.offset,
						size: e.size
					};
				} else if (n._resourceType === "textureSampler") {
					let e = n;
					r = o.texture.getGpuSampler(e);
				} else if (n._resourceType === "textureSource") {
					let e = n;
					r = o.texture.getTextureView(e);
				}
				a.push({
					binding: i[t],
					resource: r
				});
			}
			let s = o.shader.getProgramData(t).bindGroups[n], c = r.createBindGroup({
				layout: s,
				entries: a
			});
			return this._hash[e._key] = c, c;
		}
		destroy() {
			this._hash = null, this._renderer = null;
		}
	}, Nf.extension = {
		type: [f.WebGPUSystem],
		name: "bindGroup"
	};
})), Ff, If = o((() => {
	Ff = class {
		constructor(e) {
			this.items = /* @__PURE__ */ Object.create(null);
			let { renderer: t, type: n, onUnload: r, priority: i, name: a } = e;
			this._renderer = t, t.gc.addResourceHash(this, "items", n, i ?? 0), this._onUnload = r, this.name = a;
		}
		add(e) {
			return this.items[e.uid] ? !1 : (this.items[e.uid] = e, e.once("unload", this.remove, this), e._gcLastUsed = this._renderer.gc.now, !0);
		}
		remove(e, ...t) {
			if (!this.items[e.uid]) return;
			let n = e._gpuData[this._renderer.uid];
			n && (this._onUnload?.(e, ...t), n.destroy(), e._gpuData[this._renderer.uid] = null, this.items[e.uid] = null);
		}
		removeAll(...e) {
			Object.values(this.items).forEach((t) => t && this.remove(t, ...e));
		}
		destroy(...e) {
			this.removeAll(...e), this.items = /* @__PURE__ */ Object.create(null), this._renderer = null, this._onUnload = null;
		}
	};
})), Lf, Rf, zf = o((() => {
	g(), If(), Ne(), ju(), Lf = class {
		constructor(e) {
			this.gpuBuffer = e;
		}
		destroy() {
			this.gpuBuffer.destroy(), this.gpuBuffer = null;
		}
	}, Rf = class {
		constructor(e) {
			this._renderer = e, this._managedBuffers = new Ff({
				renderer: e,
				type: "resource",
				onUnload: this.onBufferUnload.bind(this),
				name: "gpuBuffer"
			});
		}
		contextChange(e) {
			this._gpu = e;
		}
		getGPUBuffer(e) {
			return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid]?.gpuBuffer || this.createGPUBuffer(e);
		}
		updateBuffer(e) {
			let t = this.getGPUBuffer(e), n = e.data;
			return e._updateID && n && (e._updateID = 0, this._gpu.device.queue.writeBuffer(t, 0, n.buffer, 0, (e._updateSize || n.byteLength) + 3 & -4)), t;
		}
		destroyAll() {
			this._managedBuffers.removeAll();
		}
		onBufferUnload(e) {
			e.off("update", this.updateBuffer, this), e.off("change", this.onBufferChange, this);
		}
		createGPUBuffer(e) {
			let t = this._gpu.device.createBuffer(e.descriptor);
			return e._updateID = 0, e._resourceId = z("resource"), e.data && (Au(e.data.buffer, t.getMappedRange(), e.data.byteOffset, e.data.byteLength), t.unmap()), e._gpuData[this._renderer.uid] = new Lf(t), this._managedBuffers.add(e) && (e.on("update", this.updateBuffer, this), e.on("change", this.onBufferChange, this)), t;
		}
		onBufferChange(e) {
			this._managedBuffers.remove(e), e._updateID = 0, this.createGPUBuffer(e);
		}
		destroy() {
			this._managedBuffers.destroy(), this._renderer = null, this._gpu = null;
		}
	}, Rf.extension = {
		type: [f.WebGPUSystem],
		name: "buffer"
	};
})), Bf, Vf = o((() => {
	g(), Bf = class {
		constructor(e) {
			this._colorMaskCache = 15, this._renderer = e;
		}
		setMask(e) {
			this._colorMaskCache !== e && (this._colorMaskCache = e, this._renderer.pipeline.setColorMask(e));
		}
		destroy() {
			this._renderer = null, this._colorMaskCache = null;
		}
	}, Bf.extension = {
		type: [f.WebGPUSystem],
		name: "colorMask"
	};
})), Hf, Uf = o((() => {
	Y(), g(), Hf = class {
		constructor(e) {
			this._renderer = e;
		}
		async init(e) {
			return this._initPromise || (this._initPromise = (e.gpu ? Promise.resolve(e.gpu) : this._createDeviceAndAdaptor(e)).then((e) => {
				this.gpu = e, this._renderer.runners.contextChange.emit(this.gpu);
			})), this._initPromise;
		}
		contextChange(e) {
			this._renderer.gpu = e;
		}
		async _createDeviceAndAdaptor(e) {
			let t = await J.get().getNavigator().gpu.requestAdapter({
				powerPreference: e.powerPreference,
				forceFallbackAdapter: e.forceFallbackAdapter
			}), n = [
				"texture-compression-bc",
				"texture-compression-astc",
				"texture-compression-etc2"
			].filter((e) => t.features.has(e));
			return {
				adapter: t,
				device: await t.requestDevice({ requiredFeatures: n })
			};
		}
		destroy() {
			this.gpu = null, this._renderer = null;
		}
	}, Hf.extension = {
		type: [f.WebGPUSystem],
		name: "device"
	}, Hf.defaultOptions = {
		powerPreference: void 0,
		forceFallbackAdapter: !1
	};
})), Wf, Gf = o((() => {
	g(), Wf = class {
		constructor(e) {
			this._boundBindGroup = /* @__PURE__ */ Object.create(null), this._boundVertexBuffer = /* @__PURE__ */ Object.create(null), this._renderer = e;
		}
		renderStart() {
			this.commandFinished = new Promise((e) => {
				this._resolveCommandFinished = e;
			}), this.commandEncoder = this._renderer.gpu.device.createCommandEncoder();
		}
		beginRenderPass(e) {
			this.endRenderPass(), this._clearCache(), this.renderPassEncoder = this.commandEncoder.beginRenderPass(e.descriptor);
		}
		endRenderPass() {
			this.renderPassEncoder && this.renderPassEncoder.end(), this.renderPassEncoder = null;
		}
		setViewport(e) {
			this.renderPassEncoder.setViewport(e.x, e.y, e.width, e.height, 0, 1);
		}
		setPipelineFromGeometryProgramAndState(e, t, n, r) {
			let i = this._renderer.pipeline.getPipeline(e, t, n, r);
			this.setPipeline(i);
		}
		setPipeline(e) {
			this._boundPipeline !== e && (this._boundPipeline = e, this.renderPassEncoder.setPipeline(e));
		}
		_setVertexBuffer(e, t) {
			this._boundVertexBuffer[e] !== t && (this._boundVertexBuffer[e] = t, this.renderPassEncoder.setVertexBuffer(e, this._renderer.buffer.updateBuffer(t)));
		}
		_setIndexBuffer(e) {
			if (this._boundIndexBuffer === e) return;
			this._boundIndexBuffer = e;
			let t = e.data.BYTES_PER_ELEMENT === 2 ? "uint16" : "uint32";
			this.renderPassEncoder.setIndexBuffer(this._renderer.buffer.updateBuffer(e), t);
		}
		resetBindGroup(e) {
			this._boundBindGroup[e] = null;
		}
		setBindGroup(e, t, n) {
			if (this._boundBindGroup[e] === t) return;
			this._boundBindGroup[e] = t, t._touch(this._renderer.gc.now, this._renderer.tick);
			let r = this._renderer.bindGroup.getBindGroup(t, n, e);
			this.renderPassEncoder.setBindGroup(e, r);
		}
		setGeometry(e, t) {
			let n = this._renderer.pipeline.getBufferNamesToBind(e, t);
			for (let t in n) this._setVertexBuffer(parseInt(t, 10), e.attributes[n[t]].buffer);
			e.indexBuffer && this._setIndexBuffer(e.indexBuffer);
		}
		_setShaderBindGroups(e, t) {
			for (let n in e.groups) {
				let r = e.groups[n];
				t || this._syncBindGroup(r), this.setBindGroup(n, r, e.gpuProgram);
			}
		}
		_syncBindGroup(e) {
			for (let t in e.resources) {
				let n = e.resources[t];
				n.isUniformGroup && this._renderer.ubo.updateUniformGroup(n);
			}
		}
		draw(e) {
			let { geometry: t, shader: n, state: r, topology: i, size: a, start: o, instanceCount: s, skipSync: c } = e;
			this.setPipelineFromGeometryProgramAndState(t, n.gpuProgram, r, i), this.setGeometry(t, n.gpuProgram), this._setShaderBindGroups(n, c), t.indexBuffer ? this.renderPassEncoder.drawIndexed(a || t.indexBuffer.data.length, s ?? t.instanceCount, o || 0) : this.renderPassEncoder.draw(a || t.getSize(), s ?? t.instanceCount, o || 0);
		}
		finishRenderPass() {
			this.renderPassEncoder && (this.renderPassEncoder.end(), this.renderPassEncoder = null);
		}
		postrender() {
			this.finishRenderPass(), this._gpu.device.queue.submit([this.commandEncoder.finish()]), this._resolveCommandFinished(), this.commandEncoder = null;
		}
		restoreRenderPass() {
			let e = this._renderer.renderTarget.adaptor.getDescriptor(this._renderer.renderTarget.renderTarget, !1, [
				0,
				0,
				0,
				1
			], this._renderer.renderTarget.mipLevel, this._renderer.renderTarget.layer);
			this.renderPassEncoder = this.commandEncoder.beginRenderPass(e);
			let t = this._boundPipeline, n = { ...this._boundVertexBuffer }, r = this._boundIndexBuffer, i = { ...this._boundBindGroup };
			this._clearCache();
			let a = this._renderer.renderTarget.viewport;
			this.renderPassEncoder.setViewport(a.x, a.y, a.width, a.height, 0, 1), this.setPipeline(t);
			for (let e in n) this._setVertexBuffer(e, n[e]);
			for (let e in i) this.setBindGroup(e, i[e], null);
			this._setIndexBuffer(r);
		}
		_clearCache() {
			for (let e = 0; e < 16; e++) this._boundBindGroup[e] = null, this._boundVertexBuffer[e] = null;
			this._boundIndexBuffer = null, this._boundPipeline = null;
		}
		destroy() {
			this._renderer = null, this._gpu = null, this._boundBindGroup = null, this._boundVertexBuffer = null, this._boundIndexBuffer = null, this._boundPipeline = null;
		}
		contextChange(e) {
			this._gpu = e;
		}
	}, Wf.extension = {
		type: [f.WebGPUSystem],
		name: "encoder",
		priority: 1
	};
})), Kf, qf = o((() => {
	g(), Kf = class {
		constructor(e) {
			this._renderer = e;
		}
		contextChange() {
			this.maxTextures = this._renderer.device.gpu.device.limits.maxSampledTexturesPerShaderStage, this.maxBatchableTextures = this.maxTextures;
		}
		destroy() {}
	}, Kf.extension = {
		type: [f.WebGPUSystem],
		name: "limits"
	};
})), Jf, Yf = o((() => {
	g(), Pu(), Jf = class {
		constructor(e) {
			this._renderTargetStencilState = /* @__PURE__ */ Object.create(null), this._renderer = e, e.renderTarget.onRenderTargetChange.add(this);
		}
		onRenderTargetChange(e) {
			let t = this._renderTargetStencilState[e.uid];
			t || (t = this._renderTargetStencilState[e.uid] = {
				stencilMode: Nu.DISABLED,
				stencilReference: 0
			}), this._activeRenderTarget = e, this.setStencilMode(t.stencilMode, t.stencilReference);
		}
		setStencilMode(e, t) {
			let n = this._renderTargetStencilState[this._activeRenderTarget.uid];
			n.stencilMode = e, n.stencilReference = t;
			let r = this._renderer;
			r.pipeline.setStencilMode(e), r.encoder.renderPassEncoder.setStencilReference(t);
		}
		destroy() {
			this._renderer.renderTarget.onRenderTargetChange.remove(this), this._renderer = null, this._activeRenderTarget = null, this._renderTargetStencilState = null;
		}
	}, Jf.extension = {
		type: [f.WebGPUSystem],
		name: "stencil"
	};
})), Xf, Zf = o((() => {
	Us(), ts(), $o(), Xf = class {
		constructor(e) {
			this._syncFunctionHash = /* @__PURE__ */ Object.create(null), this._adaptor = e, this._systemCheck();
		}
		_systemCheck() {
			if (!Vs()) throw Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.");
		}
		ensureUniformGroup(e) {
			let t = this.getUniformGroupData(e);
			e.buffer || (e.buffer = new es({
				data: new Float32Array(t.layout.size / 4),
				usage: X.UNIFORM | X.COPY_DST
			}));
		}
		getUniformGroupData(e) {
			return this._syncFunctionHash[e._signature] || this._initUniformGroup(e);
		}
		_initUniformGroup(e) {
			let t = e._signature, n = this._syncFunctionHash[t];
			if (!n) {
				let r = Object.keys(e.uniformStructures).map((t) => e.uniformStructures[t]), i = this._adaptor.createUboElements(r), a = this._generateUboSync(i.uboElements);
				n = this._syncFunctionHash[t] = {
					layout: i,
					syncFunction: a
				};
			}
			return this._syncFunctionHash[t];
		}
		_generateUboSync(e) {
			return this._adaptor.generateUboSync(e);
		}
		syncUniformGroup(e, t, n) {
			let r = this.getUniformGroupData(e);
			e.buffer || (e.buffer = new es({
				data: new Float32Array(r.layout.size / 4),
				usage: X.UNIFORM | X.COPY_DST
			}));
			let i = null;
			return t || (t = e.buffer.data, i = e.buffer.dataInt32), n || (n = 0), r.syncFunction(e.uniforms, t, i, n), !0;
		}
		updateUniformGroup(e) {
			if (e.isStatic && !e._dirtyId) return !1;
			e._dirtyId = 0;
			let t = this.syncUniformGroup(e);
			return e.buffer.update(), t;
		}
		destroy() {
			this._syncFunctionHash = null;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/createUboElementsWGSL.mjs
function Qf(e) {
	let t = e.map((e) => ({
		data: e,
		offset: 0,
		size: 0
	})), n = 0;
	for (let e = 0; e < t.length; e++) {
		let r = t[e], i = $f[r.data.type].size, a = $f[r.data.type].align;
		if (!$f[r.data.type]) throw Error(`[Pixi.js] WebGPU UniformBuffer: Unknown type ${r.data.type}`);
		r.data.size > 1 && (i = Math.max(i, a) * r.data.size), n = Math.ceil(n / a) * a, r.size = i, r.offset = n, n += i;
	}
	return n = Math.ceil(n / 16) * 16, {
		uboElements: t,
		size: n
	};
}
var $f, ep = o((() => {
	$f = {
		i32: {
			align: 4,
			size: 4
		},
		u32: {
			align: 4,
			size: 4
		},
		f32: {
			align: 4,
			size: 4
		},
		f16: {
			align: 2,
			size: 2
		},
		"vec2<i32>": {
			align: 8,
			size: 8
		},
		"vec2<u32>": {
			align: 8,
			size: 8
		},
		"vec2<f32>": {
			align: 8,
			size: 8
		},
		"vec2<f16>": {
			align: 4,
			size: 4
		},
		"vec3<i32>": {
			align: 16,
			size: 12
		},
		"vec3<u32>": {
			align: 16,
			size: 12
		},
		"vec3<f32>": {
			align: 16,
			size: 12
		},
		"vec3<f16>": {
			align: 8,
			size: 6
		},
		"vec4<i32>": {
			align: 16,
			size: 16
		},
		"vec4<u32>": {
			align: 16,
			size: 16
		},
		"vec4<f32>": {
			align: 16,
			size: 16
		},
		"vec4<f16>": {
			align: 8,
			size: 8
		},
		"mat2x2<f32>": {
			align: 8,
			size: 16
		},
		"mat2x2<f16>": {
			align: 4,
			size: 8
		},
		"mat3x2<f32>": {
			align: 8,
			size: 24
		},
		"mat3x2<f16>": {
			align: 4,
			size: 12
		},
		"mat4x2<f32>": {
			align: 8,
			size: 32
		},
		"mat4x2<f16>": {
			align: 4,
			size: 16
		},
		"mat2x3<f32>": {
			align: 16,
			size: 32
		},
		"mat2x3<f16>": {
			align: 8,
			size: 16
		},
		"mat3x3<f32>": {
			align: 16,
			size: 48
		},
		"mat3x3<f16>": {
			align: 8,
			size: 24
		},
		"mat4x3<f32>": {
			align: 16,
			size: 64
		},
		"mat4x3<f16>": {
			align: 8,
			size: 32
		},
		"mat2x4<f32>": {
			align: 16,
			size: 32
		},
		"mat2x4<f16>": {
			align: 8,
			size: 16
		},
		"mat3x4<f32>": {
			align: 16,
			size: 48
		},
		"mat3x4<f16>": {
			align: 8,
			size: 24
		},
		"mat4x4<f32>": {
			align: 16,
			size: 64
		},
		"mat4x4<f16>": {
			align: 8,
			size: 32
		}
	};
})), tp, np = o((() => {
	tp = [
		{
			type: "mat3x3<f32>",
			test: (e) => e.value.a !== void 0,
			ubo: "\n            var matrix = uv[name].toArray(true);\n            data[offset] = matrix[0];\n            data[offset + 1] = matrix[1];\n            data[offset + 2] = matrix[2];\n            data[offset + 4] = matrix[3];\n            data[offset + 5] = matrix[4];\n            data[offset + 6] = matrix[5];\n            data[offset + 8] = matrix[6];\n            data[offset + 9] = matrix[7];\n            data[offset + 10] = matrix[8];\n        ",
			uniform: "\n            gl.uniformMatrix3fv(ud[name].location, false, uv[name].toArray(true));\n        "
		},
		{
			type: "vec4<f32>",
			test: (e) => e.type === "vec4<f32>" && e.size === 1 && e.value.width !== void 0,
			ubo: "\n            v = uv[name];\n            data[offset] = v.x;\n            data[offset + 1] = v.y;\n            data[offset + 2] = v.width;\n            data[offset + 3] = v.height;\n        ",
			uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.x || cv[1] !== v.y || cv[2] !== v.width || cv[3] !== v.height) {\n                cv[0] = v.x;\n                cv[1] = v.y;\n                cv[2] = v.width;\n                cv[3] = v.height;\n                gl.uniform4f(ud[name].location, v.x, v.y, v.width, v.height);\n            }\n        "
		},
		{
			type: "vec2<f32>",
			test: (e) => e.type === "vec2<f32>" && e.size === 1 && e.value.x !== void 0,
			ubo: "\n            v = uv[name];\n            data[offset] = v.x;\n            data[offset + 1] = v.y;\n        ",
			uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.x || cv[1] !== v.y) {\n                cv[0] = v.x;\n                cv[1] = v.y;\n                gl.uniform2f(ud[name].location, v.x, v.y);\n            }\n        "
		},
		{
			type: "vec4<f32>",
			test: (e) => e.type === "vec4<f32>" && e.size === 1 && e.value.red !== void 0,
			ubo: "\n            v = uv[name];\n            data[offset] = v.red;\n            data[offset + 1] = v.green;\n            data[offset + 2] = v.blue;\n            data[offset + 3] = v.alpha;\n        ",
			uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue || cv[3] !== v.alpha) {\n                cv[0] = v.red;\n                cv[1] = v.green;\n                cv[2] = v.blue;\n                cv[3] = v.alpha;\n                gl.uniform4f(ud[name].location, v.red, v.green, v.blue, v.alpha);\n            }\n        "
		},
		{
			type: "vec3<f32>",
			test: (e) => e.type === "vec3<f32>" && e.size === 1 && e.value.red !== void 0,
			ubo: "\n            v = uv[name];\n            data[offset] = v.red;\n            data[offset + 1] = v.green;\n            data[offset + 2] = v.blue;\n        ",
			uniform: "\n            cv = ud[name].value;\n            v = uv[name];\n            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue) {\n                cv[0] = v.red;\n                cv[1] = v.green;\n                cv[2] = v.blue;\n                gl.uniform3f(ud[name].location, v.red, v.green, v.blue);\n            }\n        "
		}
	];
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/shader/utils/createUboSyncFunction.mjs
function rp(e, t, n, r) {
	let i = ["\n        var v = null;\n        var v2 = null;\n        var t = 0;\n        var index = 0;\n        var name = null;\n        var arrayOffset = null;\n    "], a = 0;
	for (let o = 0; o < e.length; o++) {
		let s = e[o], c = s.data.name, l = !1, u = 0;
		for (let e = 0; e < tp.length; e++) if (tp[e].test(s.data)) {
			u = s.offset / 4, i.push(`name = "${c}";`, `offset += ${u - a};`, tp[e][t] || tp[e].ubo), l = !0;
			break;
		}
		if (!l) if (s.data.size > 1) u = s.offset / 4, i.push(n(s, u - a));
		else {
			let e = r[s.data.type];
			u = s.offset / 4, i.push(`
                    v = uv.${c};
                    offset += ${u - a};
                    ${e};
                `);
		}
		a = u;
	}
	let o = i.join("\n");
	return Function("uv", "data", "dataInt32", "offset", o);
}
var ip = o((() => {
	np();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/shader/utils/uboSyncFunctions.mjs
function ap(e, t) {
	return `
        for (let i = 0; i < ${e * t}; i++) {
            data[offset + (((i / ${e})|0) * 4) + (i % ${e})] = v[i];
        }
    `;
}
var op, sp, cp = o((() => {
	op = {
		f32: "\n        data[offset] = v;",
		i32: "\n        dataInt32[offset] = v;",
		"vec2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];",
		"vec3<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];",
		"vec4<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 3] = v[3];",
		"vec2<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];",
		"vec3<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];\n        dataInt32[offset + 2] = v[2];",
		"vec4<i32>": "\n        dataInt32[offset] = v[0];\n        dataInt32[offset + 1] = v[1];\n        dataInt32[offset + 2] = v[2];\n        dataInt32[offset + 3] = v[3];",
		"mat2x2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 4] = v[2];\n        data[offset + 5] = v[3];",
		"mat3x3<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 4] = v[3];\n        data[offset + 5] = v[4];\n        data[offset + 6] = v[5];\n        data[offset + 8] = v[6];\n        data[offset + 9] = v[7];\n        data[offset + 10] = v[8];",
		"mat4x4<f32>": "\n        for (let i = 0; i < 16; i++) {\n            data[offset + i] = v[i];\n        }",
		"mat3x2<f32>": ap(3, 2),
		"mat4x2<f32>": ap(4, 2),
		"mat2x3<f32>": ap(2, 3),
		"mat4x3<f32>": ap(4, 3),
		"mat2x4<f32>": ap(2, 4),
		"mat3x4<f32>": ap(3, 4)
	}, sp = {
		...op,
		"mat2x2<f32>": "\n        data[offset] = v[0];\n        data[offset + 1] = v[1];\n        data[offset + 2] = v[2];\n        data[offset + 3] = v[3];\n    "
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/generateArraySyncWGSL.mjs
function lp(e, t) {
	let { size: n, align: r } = $f[e.data.type], i = (r - n) / 4, a = e.data.type.indexOf("i32") >= 0 ? "dataInt32" : "data";
	return `
         v = uv.${e.data.name};
         ${t === 0 ? "" : `offset += ${t};`}

         arrayOffset = offset;

         t = 0;

         for(var i=0; i < ${e.data.size * (n / 4)}; i++)
         {
             for(var j = 0; j < ${n / 4}; j++)
             {
                 ${a}[arrayOffset++] = v[t++];
             }
             ${i === 0 ? "" : `arrayOffset += ${i};`}
         }
     `;
}
var up = o((() => {
	ep();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/createUboSyncFunctionWGSL.mjs
function dp(e) {
	return rp(e, "uboWgsl", lp, sp);
}
var fp = o((() => {
	ip(), cp(), up();
})), pp, mp = o((() => {
	g(), Zf(), ep(), fp(), pp = class extends Xf {
		constructor() {
			super({
				createUboElements: Qf,
				generateUboSync: dp
			});
		}
	}, pp.extension = {
		type: [f.WebGPUSystem],
		name: "ubo"
	};
})), hp, gp = o((() => {
	b(), Ne(), hp = class extends y {
		constructor({ buffer: e, offset: t, size: n }) {
			super(), this.uid = z("buffer"), this._resourceType = "bufferResource", this._touched = 0, this._resourceId = z("resource"), this._bufferResource = !0, this.destroyed = !1, this.buffer = e, this.offset = t | 0, this.size = n, this.buffer.on("change", this.onBufferChange, this);
		}
		onBufferChange() {
			this._resourceId = z("resource"), this.emit("change", this);
		}
		destroy(e = !1) {
			this.destroyed = !0, e && this.buffer.destroy(), this.emit("change", this), this.buffer = null, this.removeAllListeners();
		}
	};
})), _p, vp = o((() => {
	_p = class {
		constructor({ minUniformOffsetAlignment: e }) {
			this._minUniformOffsetAlignment = 256, this.byteIndex = 0, this._minUniformOffsetAlignment = e, this.data = new Float32Array(65535);
		}
		clear() {
			this.byteIndex = 0;
		}
		addEmptyGroup(e) {
			if (e > this._minUniformOffsetAlignment / 4) throw Error(`UniformBufferBatch: array is too large: ${e * 4}`);
			let t = this.byteIndex, n = t + e * 4;
			if (n = Math.ceil(n / this._minUniformOffsetAlignment) * this._minUniformOffsetAlignment, n > this.data.length * 4) throw Error("UniformBufferBatch: ubo batch got too big");
			return this.byteIndex = n, t;
		}
		addGroup(e) {
			let t = this.addEmptyGroup(e.length);
			for (let n = 0; n < e.length; n++) this.data[t / 4 + n] = e[n];
			return t;
		}
		destroy() {
			this.data = null;
		}
	};
})), yp, bp, xp = o((() => {
	g(), ts(), gp(), $o(), vp(), yo(), yp = 128, bp = class {
		constructor(e) {
			this._bindGroupHash = /* @__PURE__ */ Object.create(null), this._buffers = [], this._bindGroups = [], this._bufferResources = [], this._renderer = e, this._batchBuffer = new _p({ minUniformOffsetAlignment: yp });
			let t = 256 / yp;
			for (let e = 0; e < t; e++) {
				let t = X.UNIFORM | X.COPY_DST;
				e === 0 && (t |= X.COPY_SRC), this._buffers.push(new es({
					data: this._batchBuffer.data,
					usage: t
				}));
			}
		}
		renderEnd() {
			this._uploadBindGroups(), this._resetBindGroups();
		}
		_resetBindGroups() {
			this._bindGroupHash = /* @__PURE__ */ Object.create(null), this._batchBuffer.clear();
		}
		getUniformBindGroup(e, t) {
			if (!t && this._bindGroupHash[e.uid]) return this._bindGroupHash[e.uid];
			this._renderer.ubo.ensureUniformGroup(e);
			let n = e.buffer.data, r = this._batchBuffer.addEmptyGroup(n.length);
			return this._renderer.ubo.syncUniformGroup(e, this._batchBuffer.data, r / 4), this._bindGroupHash[e.uid] = this._getBindGroup(r / yp), this._bindGroupHash[e.uid];
		}
		getUboResource(e) {
			this._renderer.ubo.updateUniformGroup(e);
			let t = e.buffer.data, n = this._batchBuffer.addGroup(t);
			return this._getBufferResource(n / yp);
		}
		getArrayBindGroup(e) {
			let t = this._batchBuffer.addGroup(e);
			return this._getBindGroup(t / yp);
		}
		getArrayBufferResource(e) {
			let t = this._batchBuffer.addGroup(e) / yp;
			return this._getBufferResource(t);
		}
		_getBufferResource(e) {
			if (!this._bufferResources[e]) {
				let t = this._buffers[e % 2];
				this._bufferResources[e] = new hp({
					buffer: t,
					offset: (e / 2 | 0) * 256,
					size: yp
				});
			}
			return this._bufferResources[e];
		}
		_getBindGroup(e) {
			if (!this._bindGroups[e]) {
				let t = new vo({ 0: this._getBufferResource(e) });
				this._bindGroups[e] = t;
			}
			return this._bindGroups[e];
		}
		_uploadBindGroups() {
			let e = this._renderer.buffer, t = this._buffers[0];
			t.update(this._batchBuffer.byteIndex), e.updateBuffer(t);
			let n = this._renderer.gpu.device.createCommandEncoder();
			for (let r = 1; r < this._buffers.length; r++) {
				let i = this._buffers[r];
				n.copyBufferToBuffer(e.getGPUBuffer(t), yp, e.getGPUBuffer(i), 0, this._batchBuffer.byteIndex);
			}
			this._renderer.gpu.device.queue.submit([n.finish()]);
		}
		destroy() {
			for (let e = 0; e < this._bindGroups.length; e++) this._bindGroups[e]?.destroy();
			this._bindGroups = null, this._bindGroupHash = null;
			for (let e = 0; e < this._buffers.length; e++) this._buffers[e].destroy();
			this._buffers = null;
			for (let e = 0; e < this._bufferResources.length; e++) this._bufferResources[e].destroy();
			this._bufferResources = null, this._batchBuffer.destroy(), this._renderer = null;
		}
	}, bp.extension = {
		type: [f.WebGPUPipes],
		name: "uniformBatch"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/ensureAttributes.mjs
function Sp(e, t) {
	for (let n in e.attributes) {
		let r = e.attributes[n], i = t[n];
		i ? (r.format ?? (r.format = i.format), r.offset ?? (r.offset = i.offset), r.instance ?? (r.instance = i.instance)) : H(`Attribute ${n} is not present in the shader, but is present in the geometry. Unable to infer attribute details.`);
	}
	Cp(e);
}
function Cp(e) {
	let { buffers: t, attributes: n } = e, r = {}, i = {};
	for (let e in t) {
		let n = t[e];
		r[n.uid] = 0, i[n.uid] = 0;
	}
	for (let e in n) {
		let t = n[e];
		r[t.buffer.uid] += Ya(t.format).stride;
	}
	for (let e in n) {
		let t = n[e];
		t.stride ?? (t.stride = r[t.buffer.uid]), t.start ?? (t.start = i[t.buffer.uid]), i[t.buffer.uid] += Ya(t.format).stride;
	}
}
var wp = o((() => {
	U(), Za();
})), Tp, Ep = o((() => {
	Pu(), Tp = [], Tp[Nu.NONE] = void 0, Tp[Nu.DISABLED] = {
		stencilWriteMask: 0,
		stencilReadMask: 0
	}, Tp[Nu.RENDERING_MASK_ADD] = {
		stencilFront: {
			compare: "equal",
			passOp: "increment-clamp"
		},
		stencilBack: {
			compare: "equal",
			passOp: "increment-clamp"
		}
	}, Tp[Nu.RENDERING_MASK_REMOVE] = {
		stencilFront: {
			compare: "equal",
			passOp: "decrement-clamp"
		},
		stencilBack: {
			compare: "equal",
			passOp: "decrement-clamp"
		}
	}, Tp[Nu.MASK_ACTIVE] = {
		stencilWriteMask: 0,
		stencilFront: {
			compare: "equal",
			passOp: "keep"
		},
		stencilBack: {
			compare: "equal",
			passOp: "keep"
		}
	}, Tp[Nu.INVERSE_MASK_ACTIVE] = {
		stencilWriteMask: 0,
		stencilFront: {
			compare: "not-equal",
			passOp: "keep"
		},
		stencilBack: {
			compare: "not-equal",
			passOp: "keep"
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/pipeline/PipelineSystem.mjs
function Dp(e, t, n, r, i) {
	return e << 24 | t << 16 | n << 10 | r << 5 | i;
}
function Op(e, t, n, r, i) {
	return n << 8 | e << 5 | r << 3 | i << 1 | t;
}
var kp, Ap, jp = o((() => {
	g(), U(), wp(), Pu(), Ta(), Ep(), kp = {
		"point-list": 0,
		"line-list": 1,
		"line-strip": 2,
		"triangle-list": 3,
		"triangle-strip": 4
	}, Ap = class {
		constructor(e) {
			this._moduleCache = /* @__PURE__ */ Object.create(null), this._bufferLayoutsCache = /* @__PURE__ */ Object.create(null), this._bindingNamesCache = /* @__PURE__ */ Object.create(null), this._pipeCache = /* @__PURE__ */ Object.create(null), this._pipeStateCaches = /* @__PURE__ */ Object.create(null), this._colorMask = 15, this._multisampleCount = 1, this._colorTargetCount = 1, this._renderer = e;
		}
		contextChange(e) {
			this._gpu = e, this.setStencilMode(Nu.DISABLED), this._updatePipeHash();
		}
		setMultisampleCount(e) {
			this._multisampleCount !== e && (this._multisampleCount = e, this._updatePipeHash());
		}
		setRenderTarget(e) {
			this._multisampleCount = e.msaaSamples, this._depthStencilAttachment = e.descriptor.depthStencilAttachment ? 1 : 0, this._colorTargetCount = e.colorTargetCount, this._updatePipeHash();
		}
		setColorMask(e) {
			this._colorMask !== e && (this._colorMask = e, this._updatePipeHash());
		}
		setStencilMode(e) {
			this._stencilMode !== e && (this._stencilMode = e, this._stencilState = Tp[e], this._updatePipeHash());
		}
		setPipeline(e, t, n, r) {
			let i = this.getPipeline(e, t, n);
			r.setPipeline(i);
		}
		getPipeline(e, t, n, r) {
			e._layoutKey || (Sp(e, t.attributeData), this._generateBufferKey(e)), r || (r = e.topology);
			let i = Dp(e._layoutKey, t._layoutKey, n.data, n._blendModeId, kp[r]);
			return this._pipeCache[i] || (this._pipeCache[i] = this._createPipeline(e, t, n, r)), this._pipeCache[i];
		}
		_createPipeline(e, t, n, r) {
			let i = this._gpu.device, a = this._createVertexBufferLayouts(e, t), o = this._renderer.state.getColorTargets(n, this._colorTargetCount), s = this._stencilMode === Nu.RENDERING_MASK_ADD ? 0 : this._colorMask;
			for (let e = 0; e < o.length; e++) o[e].writeMask = s;
			let c = this._renderer.shader.getProgramData(t).pipeline, l = {
				vertex: {
					module: this._getModule(t.vertex.source),
					entryPoint: t.vertex.entryPoint,
					buffers: a
				},
				fragment: {
					module: this._getModule(t.fragment.source),
					entryPoint: t.fragment.entryPoint,
					targets: o
				},
				primitive: {
					topology: r,
					cullMode: n.cullMode
				},
				layout: c,
				multisample: { count: this._multisampleCount },
				label: "PIXI Pipeline"
			};
			return this._depthStencilAttachment && (l.depthStencil = {
				...this._stencilState,
				format: "depth24plus-stencil8",
				depthWriteEnabled: n.depthTest,
				depthCompare: n.depthTest ? "less" : "always"
			}), i.createRenderPipeline(l);
		}
		_getModule(e) {
			return this._moduleCache[e] || this._createModule(e);
		}
		_createModule(e) {
			let t = this._gpu.device;
			return this._moduleCache[e] = t.createShaderModule({ code: e }), this._moduleCache[e];
		}
		_generateBufferKey(e) {
			let t = [], n = 0, r = Object.keys(e.attributes).sort();
			for (let i = 0; i < r.length; i++) {
				let a = e.attributes[r[i]];
				t[n++] = a.offset, t[n++] = a.format, t[n++] = a.stride, t[n++] = a.instance;
			}
			return e._layoutKey = Sa(t.join("|"), "geometry"), e._layoutKey;
		}
		_generateAttributeLocationsKey(e) {
			let t = [], n = 0, r = Object.keys(e.attributeData).sort();
			for (let i = 0; i < r.length; i++) {
				let a = e.attributeData[r[i]];
				t[n++] = a.location;
			}
			return e._attributeLocationsKey = Sa(t.join("|"), "programAttributes"), e._attributeLocationsKey;
		}
		getBufferNamesToBind(e, t) {
			let n = e._layoutKey << 16 | t._attributeLocationsKey;
			if (this._bindingNamesCache[n]) return this._bindingNamesCache[n];
			let r = this._createVertexBufferLayouts(e, t), i = /* @__PURE__ */ Object.create(null), a = t.attributeData;
			for (let e = 0; e < r.length; e++) {
				let t = Object.values(r[e].attributes)[0].shaderLocation;
				for (let n in a) if (a[n].location === t) {
					i[e] = n;
					break;
				}
			}
			return this._bindingNamesCache[n] = i, i;
		}
		_createVertexBufferLayouts(e, t) {
			t._attributeLocationsKey || this._generateAttributeLocationsKey(t);
			let n = e._layoutKey << 16 | t._attributeLocationsKey;
			if (this._bufferLayoutsCache[n]) return this._bufferLayoutsCache[n];
			let r = [];
			return e.buffers.forEach((n) => {
				let i = {
					arrayStride: 0,
					stepMode: "vertex",
					attributes: []
				}, a = i.attributes;
				for (let r in t.attributeData) {
					let o = e.attributes[r];
					(o.divisor ?? 1) !== 1 && H(`Attribute ${r} has an invalid divisor value of '${o.divisor}'. WebGPU only supports a divisor value of 1`), o.buffer === n && (i.arrayStride = o.stride, i.stepMode = o.instance ? "instance" : "vertex", a.push({
						shaderLocation: t.attributeData[r].location,
						offset: o.offset,
						format: o.format
					}));
				}
				a.length && r.push(i);
			}), this._bufferLayoutsCache[n] = r, r;
		}
		_updatePipeHash() {
			let e = Op(this._stencilMode, this._multisampleCount, this._colorMask, this._depthStencilAttachment, this._colorTargetCount);
			this._pipeStateCaches[e] || (this._pipeStateCaches[e] = /* @__PURE__ */ Object.create(null)), this._pipeCache = this._pipeStateCaches[e];
		}
		destroy() {
			this._renderer = null, this._bufferLayoutsCache = null;
		}
	}, Ap.extension = {
		type: [f.WebGPUSystem],
		name: "pipeline"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/renderTarget/calculateProjection.mjs
function Mp(e, t, n, r, i, a) {
	let o = a ? 1 : -1;
	return e.identity(), e.a = 1 / r * 2, e.d = o * (1 / i * 2), e.tx = -1 - t * e.a, e.ty = -o - n * e.d, e;
}
var Np = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/renderTarget/isRenderingToScreen.mjs
function Pp(e) {
	let t = e.colorTexture.source.resource;
	return globalThis.HTMLCanvasElement && t instanceof HTMLCanvasElement && document.body.contains(t);
}
var Fp = o((() => {})), Ip, Lp = o((() => {
	R(), dt(), Dc(), Np(), kc(), na(), ln(), q(), Ef(), Fp(), Cf(), Ip = class {
		constructor(e) {
			this.rootViewPort = new W(), this.viewport = new W(), this.mipLevel = 0, this.layer = 0, this.onRenderTargetChange = new Oc("onRenderTargetChange"), this.projectionMatrix = new L(), this.defaultClearColor = [
				0,
				0,
				0,
				0
			], this._renderSurfaceToRenderTargetHash = /* @__PURE__ */ new Map(), this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null), this._renderTargetStack = [], this._renderer = e, e.gc.addCollection(this, "_gpuRenderTargetHash", "hash");
		}
		finishRenderPass() {
			this.adaptor.finishRenderPass(this.renderTarget);
		}
		renderStart({ target: e, clear: t, clearColor: n, frame: r, mipLevel: i, layer: a }) {
			this._renderTargetStack.length = 0, this.push(e, t, n, r, i ?? 0, a ?? 0), this.rootViewPort.copyFrom(this.viewport), this.rootRenderTarget = this.renderTarget, this.renderingToScreen = Pp(this.rootRenderTarget), this.adaptor.prerender?.(this.rootRenderTarget);
		}
		postrender() {
			this.adaptor.postrender?.(this.rootRenderTarget);
		}
		bind(e, t = !0, n, r, i = 0, a = 0) {
			let o = this.getRenderTarget(e), s = this.renderTarget !== o;
			this.renderTarget = o, this.renderSurface = e;
			let c = this.getGpuRenderTarget(o);
			(o.pixelWidth !== c.width || o.pixelHeight !== c.height) && (this.adaptor.resizeGpuRenderTarget(o), c.width = o.pixelWidth, c.height = o.pixelHeight);
			let l = o.colorTexture, u = this.viewport, d = l.arrayLayerCount || 1;
			if ((a | 0) !== a && (a |= 0), a < 0 || a >= d) throw Error(`[RenderTargetSystem] layer ${a} is out of bounds (arrayLayerCount=${d}).`);
			this.mipLevel = i | 0, this.layer = a | 0;
			let f = Math.max(l.pixelWidth >> i, 1), p = Math.max(l.pixelHeight >> i, 1);
			if (!r && e instanceof K && (r = e.frame), r) {
				let e = l._resolution, t = 1 << Math.max(i | 0, 0), n = r.x * e + .5 | 0, a = r.y * e + .5 | 0, o = r.width * e + .5 | 0, s = r.height * e + .5 | 0, c = Math.floor(n / t), d = Math.floor(a / t), m = Math.ceil(o / t), h = Math.ceil(s / t);
				c = Math.min(Math.max(c, 0), f - 1), d = Math.min(Math.max(d, 0), p - 1), m = Math.min(Math.max(m, 1), f - c), h = Math.min(Math.max(h, 1), p - d), u.x = c, u.y = d, u.width = m, u.height = h;
			} else u.x = 0, u.y = 0, u.width = f, u.height = p;
			return Mp(this.projectionMatrix, 0, 0, u.width / l.resolution, u.height / l.resolution, !o.isRoot), this.adaptor.startRenderPass(o, t, n, u, i, a), s && this.onRenderTargetChange.emit(o), o;
		}
		clear(e, t = Ec.ALL, n, r = this.mipLevel, i = this.layer) {
			t && (e && (e = this.getRenderTarget(e)), this.adaptor.clear(e || this.renderTarget, t, n, this.viewport, r, i));
		}
		contextChange() {
			this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null);
		}
		push(e, t = Ec.ALL, n, r, i = 0, a = 0) {
			let o = this.bind(e, t, n, r, i, a);
			return this._renderTargetStack.push({
				renderTarget: o,
				frame: r,
				mipLevel: i,
				layer: a
			}), o;
		}
		pop() {
			this._renderTargetStack.pop();
			let e = this._renderTargetStack[this._renderTargetStack.length - 1];
			this.bind(e.renderTarget, !1, null, e.frame, e.mipLevel, e.layer);
		}
		getRenderTarget(e) {
			return e.isTexture && (e = e.source), this._renderSurfaceToRenderTargetHash.get(e) ?? this._initRenderTarget(e);
		}
		copyToTexture(e, t, n, r, i) {
			n.x < 0 && (r.width += n.x, i.x -= n.x, n.x = 0), n.y < 0 && (r.height += n.y, i.y -= n.y, n.y = 0);
			let { pixelWidth: a, pixelHeight: o } = e;
			return r.width = Math.min(r.width, a - n.x), r.height = Math.min(r.height, o - n.y), this.adaptor.copyToTexture(e, t, n, r, i);
		}
		ensureDepthStencil() {
			this.renderTarget.stencil || (this.renderTarget.stencil = !0, this.adaptor.startRenderPass(this.renderTarget, !1, null, this.viewport, 0, this.layer));
		}
		destroy() {
			this._renderer = null, this._renderSurfaceToRenderTargetHash.forEach((e, t) => {
				e !== t && e.destroy();
			}), this._renderSurfaceToRenderTargetHash.clear(), this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null);
		}
		_initRenderTarget(e) {
			let t = null;
			return ta.test(e) && (e = wf(e).source), e instanceof Sf ? t = e : e instanceof cn && (t = new Sf({ colorTextures: [e] }), e.source instanceof ta && (t.isRoot = !0), e.once("destroy", () => {
				t.destroy(), this._renderSurfaceToRenderTargetHash.delete(e);
				let n = this._gpuRenderTargetHash[t.uid];
				n && (this._gpuRenderTargetHash[t.uid] = null, this.adaptor.destroyGpuRenderTarget(n));
			})), this._renderSurfaceToRenderTargetHash.set(e, t), t;
		}
		getGpuRenderTarget(e) {
			return this._gpuRenderTargetHash[e.uid] || (this._gpuRenderTargetHash[e.uid] = this.adaptor.initGpuRenderTarget(e));
		}
		resetState() {
			this.renderTarget = null, this.renderSurface = null;
		}
	};
})), Rp, zp = o((() => {
	Rp = class {
		constructor() {
			this.contexts = [], this.msaaTextures = [], this.msaaSamples = 1;
		}
	};
})), Bp, Vp = o((() => {
	Dc(), na(), ln(), zp(), Bp = class {
		init(e, t) {
			this._renderer = e, this._renderTargetSystem = t;
		}
		copyToTexture(e, t, n, r, i) {
			let a = this._renderer, o = this._getGpuColorTexture(e), s = a.texture.getGpuSource(t.source);
			return a.encoder.commandEncoder.copyTextureToTexture({
				texture: o,
				origin: n
			}, {
				texture: s,
				origin: i
			}, r), t;
		}
		startRenderPass(e, t = !0, n, r, i = 0, a = 0) {
			let o = this._renderTargetSystem.getGpuRenderTarget(e);
			if (a !== 0 && o.msaaTextures?.length) throw Error("[RenderTargetSystem] Rendering to array layers is not supported with MSAA render targets.");
			if (i > 0 && o.msaaTextures?.length) throw Error("[RenderTargetSystem] Rendering to mip levels is not supported with MSAA render targets.");
			o.descriptor = this.getDescriptor(e, t, n, i, a), this._renderer.pipeline.setRenderTarget(o), this._renderer.encoder.beginRenderPass(o), this._renderer.encoder.setViewport(r);
		}
		finishRenderPass() {
			this._renderer.encoder.endRenderPass();
		}
		_getGpuColorTexture(e) {
			let t = this._renderTargetSystem.getGpuRenderTarget(e);
			return t.contexts[0] ? t.contexts[0].getCurrentTexture() : this._renderer.texture.getGpuSource(e.colorTextures[0].source);
		}
		getDescriptor(e, t, n, r = 0, i = 0) {
			typeof t == "boolean" && (t = t ? Ec.ALL : Ec.NONE);
			let a = this._renderTargetSystem, o = a.getGpuRenderTarget(e), s = e.colorTextures.map((e, s) => {
				let c = o.contexts[s], l, u;
				if (c) {
					if (i !== 0) throw Error("[RenderTargetSystem] Rendering to array layers is not supported for canvas targets.");
					l = c.getCurrentTexture().createView();
				} else l = this._renderer.texture.getGpuSource(e).createView({
					dimension: "2d",
					baseMipLevel: r,
					mipLevelCount: 1,
					baseArrayLayer: i,
					arrayLayerCount: 1
				});
				o.msaaTextures[s] && (u = l, l = this._renderer.texture.getTextureView(o.msaaTextures[s]));
				let d = t & Ec.COLOR ? "clear" : "load";
				return n ?? (n = a.defaultClearColor), {
					view: l,
					resolveTarget: u,
					clearValue: n,
					storeOp: "store",
					loadOp: d
				};
			}), c;
			if ((e.stencil || e.depth) && !e.depthStencilTexture && (e.ensureDepthStencilTexture(), e.depthStencilTexture.source.sampleCount = o.msaa ? 4 : 1), e.depthStencilTexture) {
				let n = t & Ec.STENCIL ? "clear" : "load", a = t & Ec.DEPTH ? "clear" : "load";
				c = {
					view: this._renderer.texture.getGpuSource(e.depthStencilTexture.source).createView({
						dimension: "2d",
						baseMipLevel: r,
						mipLevelCount: 1,
						baseArrayLayer: i,
						arrayLayerCount: 1
					}),
					stencilStoreOp: "store",
					stencilLoadOp: n,
					depthClearValue: 1,
					depthLoadOp: a,
					depthStoreOp: "store"
				};
			}
			return {
				colorAttachments: s,
				depthStencilAttachment: c
			};
		}
		clear(e, t = !0, n, r, i = 0, a = 0) {
			if (!t) return;
			let { gpu: o, encoder: s } = this._renderer, c = o.device;
			if (s.commandEncoder === null) {
				let o = c.createCommandEncoder(), s = this.getDescriptor(e, t, n, i, a), l = o.beginRenderPass(s);
				l.setViewport(r.x, r.y, r.width, r.height, 0, 1), l.end();
				let u = o.finish();
				c.queue.submit([u]);
			} else this.startRenderPass(e, t, n, r, i, a);
		}
		initGpuRenderTarget(e) {
			e.isRoot = !0;
			let t = new Rp();
			return t.colorTargetCount = e.colorTextures.length, e.colorTextures.forEach((e, n) => {
				if (e instanceof ta) {
					let r = e.resource.getContext("webgpu"), i = e.transparent ? "premultiplied" : "opaque";
					try {
						r.configure({
							device: this._renderer.gpu.device,
							usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
							format: "bgra8unorm",
							alphaMode: i
						});
					} catch (e) {
						console.error(e);
					}
					t.contexts[n] = r;
				}
				if (t.msaa = e.source.antialias, e.source.antialias) {
					let r = new cn({
						width: 0,
						height: 0,
						sampleCount: 4,
						arrayLayerCount: e.source.arrayLayerCount
					});
					t.msaaTextures[n] = r;
				}
			}), t.msaa && (t.msaaSamples = 4, e.depthStencilTexture && (e.depthStencilTexture.source.sampleCount = 4)), t;
		}
		destroyGpuRenderTarget(e) {
			e.contexts.forEach((e) => {
				e.unconfigure();
			}), e.msaaTextures.forEach((e) => {
				e.destroy();
			}), e.msaaTextures.length = 0, e.contexts.length = 0;
		}
		ensureDepthStencilTexture(e) {
			let t = this._renderTargetSystem.getGpuRenderTarget(e);
			e.depthStencilTexture && t.msaa && (e.depthStencilTexture.source.sampleCount = 4);
		}
		resizeGpuRenderTarget(e) {
			let t = this._renderTargetSystem.getGpuRenderTarget(e);
			t.width = e.width, t.height = e.height, t.msaa && e.colorTextures.forEach((e, n) => {
				t.msaaTextures[n]?.resize(e.source.width, e.source.height, e.source._resolution);
			});
		}
	};
})), Hp, Up = o((() => {
	g(), Lp(), Vp(), Hp = class extends Ip {
		constructor(e) {
			super(e), this.adaptor = new Bp(), this.adaptor.init(e, this);
		}
	}, Hp.extension = {
		type: [f.WebGPUSystem],
		name: "renderTarget"
	};
})), Wp, Gp = o((() => {
	g(), Wp = class {
		constructor() {
			this._gpuProgramData = /* @__PURE__ */ Object.create(null);
		}
		contextChange(e) {
			this._gpu = e;
		}
		getProgramData(e) {
			return this._gpuProgramData[e._layoutKey] || this._createGPUProgramData(e);
		}
		_createGPUProgramData(e) {
			let t = this._gpu.device, n = e.gpuLayout.map((e) => t.createBindGroupLayout({ entries: e })), r = { bindGroupLayouts: n };
			return this._gpuProgramData[e._layoutKey] = {
				bindGroups: n,
				pipeline: t.createPipelineLayout(r)
			}, this._gpuProgramData[e._layoutKey];
		}
		destroy() {
			this._gpu = null, this._gpuProgramData = null;
		}
	}, Wp.extension = {
		type: [f.WebGPUSystem],
		name: "shader"
	};
})), Kp, qp = o((() => {
	Kp = {}, Kp.normal = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		}
	}, Kp.add = {
		alpha: {
			srcFactor: "src-alpha",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "add"
		}
	}, Kp.multiply = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "dst",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		}
	}, Kp.screen = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one-minus-src",
			operation: "add"
		}
	}, Kp.overlay = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one-minus-src",
			operation: "add"
		}
	}, Kp.none = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "zero",
			dstFactor: "zero",
			operation: "add"
		}
	}, Kp["normal-npm"] = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "src-alpha",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		}
	}, Kp["add-npm"] = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "add"
		},
		color: {
			srcFactor: "src-alpha",
			dstFactor: "one",
			operation: "add"
		}
	}, Kp["screen-npm"] = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "src-alpha",
			dstFactor: "one-minus-src",
			operation: "add"
		}
	}, Kp.erase = {
		alpha: {
			srcFactor: "zero",
			dstFactor: "one-minus-src-alpha",
			operation: "add"
		},
		color: {
			srcFactor: "zero",
			dstFactor: "one-minus-src",
			operation: "add"
		}
	}, Kp.min = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "min"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "min"
		}
	}, Kp.max = {
		alpha: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "max"
		},
		color: {
			srcFactor: "one",
			dstFactor: "one",
			operation: "max"
		}
	};
})), Jp, Yp = o((() => {
	g(), Vo(), qp(), Jp = class {
		constructor() {
			this.defaultState = new Bo(), this.defaultState.blend = !0;
		}
		contextChange(e) {
			this.gpu = e;
		}
		getColorTargets(e, t) {
			let n = Kp[e.blendMode] || Kp.normal, r = [], i = {
				format: "bgra8unorm",
				writeMask: 0,
				blend: n
			};
			for (let e = 0; e < t; e++) r[e] = i;
			return r;
		}
		destroy() {
			this.gpu = null;
		}
	}, Jp.extension = {
		type: [f.WebGPUSystem],
		name: "state"
	};
})), Xp, Zp, Qp = o((() => {
	Y(), Qt(), Ve(), Xp = class {
		constructor(e) {
			this._canvasPool = /* @__PURE__ */ Object.create(null), this.canvasOptions = e || {}, this.enableFullScreen = !1;
		}
		_createCanvasAndContext(e, t) {
			let n = J.get().createCanvas();
			return n.width = e, n.height = t, {
				canvas: n,
				context: n.getContext("2d")
			};
		}
		getOptimalCanvasAndContext(e, t, n = 1) {
			e = Math.ceil(e * n - 1e-6), t = Math.ceil(t * n - 1e-6), e = Xt(e), t = Xt(t);
			let r = (e << 17) + (t << 1);
			this._canvasPool[r] || (this._canvasPool[r] = []);
			let i = this._canvasPool[r].pop();
			return i || (i = this._createCanvasAndContext(e, t)), i;
		}
		returnCanvasAndContext(e) {
			let { width: t, height: n } = e.canvas, r = (t << 17) + (n << 1);
			e.context.resetTransform(), e.context.clearRect(0, 0, t, n), this._canvasPool[r].push(e);
		}
		clear() {
			this._canvasPool = {};
		}
	}, Zp = new Xp(), Be.register(Zp);
})), $p, em = o((() => {
	$p = {
		type: "image",
		upload(e, t, n, r = 0) {
			let i = e.resource, a = (e.pixelWidth | 0) * (e.pixelHeight | 0), o = i.byteLength / a;
			n.device.queue.writeTexture({
				texture: t,
				origin: {
					x: 0,
					y: 0,
					z: r
				}
			}, i, {
				offset: 0,
				rowsPerImage: e.pixelHeight,
				bytesPerRow: e.pixelWidth * o
			}, {
				width: e.pixelWidth,
				height: e.pixelHeight,
				depthOrArrayLayers: 1
			});
		}
	};
})), tm, nm, rm, im = o((() => {
	tm = {
		"bc1-rgba-unorm": {
			blockBytes: 8,
			blockWidth: 4,
			blockHeight: 4
		},
		"bc2-rgba-unorm": {
			blockBytes: 16,
			blockWidth: 4,
			blockHeight: 4
		},
		"bc3-rgba-unorm": {
			blockBytes: 16,
			blockWidth: 4,
			blockHeight: 4
		},
		"bc7-rgba-unorm": {
			blockBytes: 16,
			blockWidth: 4,
			blockHeight: 4
		},
		"etc1-rgb-unorm": {
			blockBytes: 8,
			blockWidth: 4,
			blockHeight: 4
		},
		"etc2-rgba8unorm": {
			blockBytes: 16,
			blockWidth: 4,
			blockHeight: 4
		},
		"astc-4x4-unorm": {
			blockBytes: 16,
			blockWidth: 4,
			blockHeight: 4
		}
	}, nm = {
		blockBytes: 4,
		blockWidth: 1,
		blockHeight: 1
	}, rm = {
		type: "compressed",
		upload(e, t, n, r = 0) {
			let i = e.pixelWidth, a = e.pixelHeight, o = tm[e.format] || nm;
			for (let s = 0; s < e.resource.length; s++) {
				let c = e.resource[s], l = Math.ceil(i / o.blockWidth) * o.blockBytes;
				n.device.queue.writeTexture({
					texture: t,
					mipLevel: s,
					origin: {
						x: 0,
						y: 0,
						z: r
					}
				}, c, {
					offset: 0,
					bytesPerRow: l
				}, {
					width: Math.ceil(i / o.blockWidth) * o.blockWidth,
					height: Math.ceil(a / o.blockHeight) * o.blockHeight,
					depthOrArrayLayers: 1
				}), i = Math.max(i >> 1, 1), a = Math.max(a >> 1, 1);
			}
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gpu/texture/uploaders/gpuUploadCubeTextureResource.mjs
function am(e) {
	return {
		type: "cube",
		upload(t, n, r) {
			let i = t.faces;
			for (let t = 0; t < om.length; t++) {
				let a = i[om[t]];
				(e[a.uploadMethodId] || e.image).upload(a, n, r, t);
			}
		}
	};
}
var om, sm = o((() => {
	om = [
		"right",
		"left",
		"top",
		"bottom",
		"front",
		"back"
	];
})), cm, lm = o((() => {
	Y(), U(), cm = {
		type: "image",
		upload(e, t, n, r = 0) {
			let i = e.resource;
			if (!i) return;
			if (globalThis.HTMLImageElement && i instanceof HTMLImageElement) {
				let t = J.get().createCanvas(i.width, i.height);
				t.getContext("2d").drawImage(i, 0, 0, i.width, i.height), e.resource = t, H("ImageSource: Image element passed, converting to canvas and replacing resource.");
			}
			let a = Math.min(t.width, e.resourceWidth || e.pixelWidth), o = Math.min(t.height, e.resourceHeight || e.pixelHeight), s = e.alphaMode === "premultiply-alpha-on-upload";
			n.device.queue.copyExternalImageToTexture({ source: i }, {
				texture: t,
				origin: {
					x: 0,
					y: 0,
					z: r
				},
				premultipliedAlpha: s
			}, {
				width: a,
				height: o
			});
		}
	};
})), um, dm = o((() => {
	lm(), um = {
		type: "video",
		upload(e, t, n, r) {
			cm.upload(e, t, n, r);
		}
	};
})), fm, pm = o((() => {
	fm = class {
		constructor(e) {
			this.device = e, this.sampler = e.createSampler({ minFilter: "linear" }), this.pipelines = {};
		}
		_getMipmapPipeline(e) {
			let t = this.pipelines[e];
			return t || (this.mipmapShaderModule || (this.mipmapShaderModule = this.device.createShaderModule({ code: "\n                        var<private> pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(\n                        vec2<f32>(-1.0, -1.0), vec2<f32>(-1.0, 3.0), vec2<f32>(3.0, -1.0));\n\n                        struct VertexOutput {\n                        @builtin(position) position : vec4<f32>,\n                        @location(0) texCoord : vec2<f32>,\n                        };\n\n                        @vertex\n                        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {\n                        var output : VertexOutput;\n                        output.texCoord = pos[vertexIndex] * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5);\n                        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);\n                        return output;\n                        }\n\n                        @group(0) @binding(0) var imgSampler : sampler;\n                        @group(0) @binding(1) var img : texture_2d<f32>;\n\n                        @fragment\n                        fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {\n                        return textureSample(img, imgSampler, texCoord);\n                        }\n                    " })), t = this.device.createRenderPipeline({
				layout: "auto",
				vertex: {
					module: this.mipmapShaderModule,
					entryPoint: "vertexMain"
				},
				fragment: {
					module: this.mipmapShaderModule,
					entryPoint: "fragmentMain",
					targets: [{ format: e }]
				}
			}), this.pipelines[e] = t), t;
		}
		generateMipmap(e) {
			let t = this._getMipmapPipeline(e.format);
			if (e.dimension === "3d" || e.dimension === "1d") throw Error("Generating mipmaps for non-2d textures is currently unsupported!");
			let n = e, r = e.depthOrArrayLayers || 1, i = e.usage & GPUTextureUsage.RENDER_ATTACHMENT;
			if (!i) {
				let t = {
					size: {
						width: Math.ceil(e.width / 2),
						height: Math.ceil(e.height / 2),
						depthOrArrayLayers: r
					},
					format: e.format,
					usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
					mipLevelCount: e.mipLevelCount - 1
				};
				n = this.device.createTexture(t);
			}
			let a = this.device.createCommandEncoder({}), o = t.getBindGroupLayout(0);
			for (let s = 0; s < r; ++s) {
				let r = e.createView({
					baseMipLevel: 0,
					mipLevelCount: 1,
					dimension: "2d",
					baseArrayLayer: s,
					arrayLayerCount: 1
				}), c = i ? 1 : 0;
				for (let i = 1; i < e.mipLevelCount; ++i) {
					let e = n.createView({
						baseMipLevel: c++,
						mipLevelCount: 1,
						dimension: "2d",
						baseArrayLayer: s,
						arrayLayerCount: 1
					}), i = a.beginRenderPass({ colorAttachments: [{
						view: e,
						storeOp: "store",
						loadOp: "clear",
						clearValue: {
							r: 0,
							g: 0,
							b: 0,
							a: 0
						}
					}] }), l = this.device.createBindGroup({
						layout: o,
						entries: [{
							binding: 0,
							resource: this.sampler
						}, {
							binding: 1,
							resource: r
						}]
					});
					i.setPipeline(t), i.setBindGroup(0, l), i.draw(3, 1, 0, 0), i.end(), r = e;
				}
			}
			if (!i) {
				let t = {
					width: Math.ceil(e.width / 2),
					height: Math.ceil(e.height / 2),
					depthOrArrayLayers: r
				};
				for (let r = 1; r < e.mipLevelCount; ++r) a.copyTextureToTexture({
					texture: n,
					mipLevel: r - 1
				}, {
					texture: e,
					mipLevel: r
				}, t), t.width = Math.ceil(t.width / 2), t.height = Math.ceil(t.height / 2);
			}
			return this.device.queue.submit([a.finish()]), i || n.destroy(), e;
		}
	};
})), mm, hm, gm = o((() => {
	Y(), g(), If(), ko(), Qp(), yo(), em(), im(), sm(), lm(), dm(), pm(), mm = class {
		constructor(e) {
			this.textureView = null, this.gpuTexture = e;
		}
		destroy() {
			this.gpuTexture.destroy(), this.textureView = null, this.gpuTexture = null;
		}
	}, hm = class {
		constructor(e) {
			this._gpuSamplers = /* @__PURE__ */ Object.create(null), this._bindGroupHash = /* @__PURE__ */ Object.create(null), this._renderer = e, e.gc.addCollection(this, "_bindGroupHash", "hash"), this._managedTextures = new Ff({
				renderer: e,
				type: "resource",
				onUnload: this.onSourceUnload.bind(this),
				name: "gpuTextureSource"
			});
			let t = {
				image: cm,
				buffer: $p,
				video: um,
				compressed: rm
			};
			this._uploads = {
				...t,
				cube: am(t)
			};
		}
		get managedTextures() {
			return Object.values(this._managedTextures.items);
		}
		contextChange(e) {
			this._gpu = e;
		}
		initSource(e) {
			return e._gpuData[this._renderer.uid]?.gpuTexture || this._initSource(e);
		}
		_initSource(e) {
			if (e.autoGenerateMipmaps) {
				let t = Math.max(e.pixelWidth, e.pixelHeight);
				e.mipLevelCount = Math.floor(Math.log2(t)) + 1;
			}
			let t = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
			e.uploadMethodId !== "compressed" && (t |= GPUTextureUsage.RENDER_ATTACHMENT, t |= GPUTextureUsage.COPY_SRC);
			let n = tm[e.format] || {
				blockBytes: 4,
				blockWidth: 1,
				blockHeight: 1
			}, r = Math.ceil(e.pixelWidth / n.blockWidth) * n.blockWidth, i = Math.ceil(e.pixelHeight / n.blockHeight) * n.blockHeight, a = {
				label: e.label,
				size: {
					width: r,
					height: i,
					depthOrArrayLayers: e.arrayLayerCount
				},
				format: e.format,
				sampleCount: e.sampleCount,
				mipLevelCount: e.mipLevelCount,
				dimension: e.dimension,
				usage: t
			}, o = this._gpu.device.createTexture(a);
			return e._gpuData[this._renderer.uid] = new mm(o), this._managedTextures.add(e) && (e.on("update", this.onSourceUpdate, this), e.on("resize", this.onSourceResize, this), e.on("updateMipmaps", this.onUpdateMipmaps, this)), this.onSourceUpdate(e), o;
		}
		onSourceUpdate(e) {
			let t = this.getGpuSource(e);
			t && (this._uploads[e.uploadMethodId] && this._uploads[e.uploadMethodId].upload(e, t, this._gpu), e.autoGenerateMipmaps && e.mipLevelCount > 1 && this.onUpdateMipmaps(e));
		}
		onUpdateMipmaps(e) {
			this._mipmapGenerator || (this._mipmapGenerator = new fm(this._gpu.device));
			let t = this.getGpuSource(e);
			this._mipmapGenerator.generateMipmap(t);
		}
		onSourceUnload(e) {
			e.off("update", this.onSourceUpdate, this), e.off("resize", this.onSourceResize, this), e.off("updateMipmaps", this.onUpdateMipmaps, this);
		}
		onSourceResize(e) {
			e._gcLastUsed = this._renderer.gc.now;
			let t = e._gpuData[this._renderer.uid], n = t?.gpuTexture;
			n ? (n.width !== e.pixelWidth || n.height !== e.pixelHeight) && (t.destroy(), this._bindGroupHash[e.uid] = null, e._gpuData[this._renderer.uid] = null, this.initSource(e)) : this.initSource(e);
		}
		_initSampler(e) {
			return this._gpuSamplers[e._resourceId] = this._gpu.device.createSampler(e), this._gpuSamplers[e._resourceId];
		}
		getGpuSampler(e) {
			return this._gpuSamplers[e._resourceId] || this._initSampler(e);
		}
		getGpuSource(e) {
			return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid]?.gpuTexture || this.initSource(e);
		}
		getTextureBindGroup(e) {
			return this._bindGroupHash[e.uid] || this._createTextureBindGroup(e);
		}
		_createTextureBindGroup(e) {
			let t = e.source;
			return this._bindGroupHash[e.uid] = new vo({
				0: t,
				1: t.style,
				2: new Oo({ uTextureMatrix: {
					type: "mat3x3<f32>",
					value: e.textureMatrix.mapCoord
				} })
			}), this._bindGroupHash[e.uid];
		}
		getTextureView(e) {
			let t = e.source;
			t._gcLastUsed = this._renderer.gc.now;
			let n = t._gpuData[this._renderer.uid];
			return n || (this.initSource(t), n = t._gpuData[this._renderer.uid]), n.textureView || (n.textureView = n.gpuTexture.createView({ dimension: t.viewDimension })), n.textureView;
		}
		generateCanvas(e) {
			let t = this._renderer, n = t.gpu.device.createCommandEncoder(), r = J.get().createCanvas();
			r.width = e.source.pixelWidth, r.height = e.source.pixelHeight;
			let i = r.getContext("webgpu");
			return i.configure({
				device: t.gpu.device,
				usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
				format: J.get().getNavigator().gpu.getPreferredCanvasFormat(),
				alphaMode: "premultiplied"
			}), n.copyTextureToTexture({
				texture: t.texture.getGpuSource(e.source),
				origin: {
					x: 0,
					y: 0
				}
			}, { texture: i.getCurrentTexture() }, {
				width: r.width,
				height: r.height
			}), t.gpu.device.queue.submit([n.finish()]), r;
		}
		getPixels(e) {
			let t = this.generateCanvas(e), n = Zp.getOptimalCanvasAndContext(t.width, t.height), r = n.context;
			r.drawImage(t, 0, 0);
			let { width: i, height: a } = t, o = r.getImageData(0, 0, i, a), s = new Uint8ClampedArray(o.data.buffer);
			return Zp.returnCanvasAndContext(n), {
				pixels: s,
				width: i,
				height: a
			};
		}
		destroy() {
			this._managedTextures.destroy();
			for (let e of Object.keys(this._bindGroupHash)) {
				let t = Number(e);
				this._bindGroupHash[t]?.destroy();
			}
			this._renderer = null, this._gpu = null, this._mipmapGenerator = null, this._gpuSamplers = null, this._bindGroupHash = null;
		}
	}, hm.extension = {
		type: [f.WebGPUSystem],
		name: "texture"
	};
})), _m = /* @__PURE__ */ c({ WebGPURenderer: () => wm }), vm, ym, bm, xm, Sm, Cm, wm, Tm = o((() => {
	g(), Wl(), Yl(), Ql(), Nc(), Mf(), xo(), Pf(), zf(), Vf(), Uf(), Gf(), qf(), Yf(), mp(), xp(), jp(), Up(), Gp(), Yp(), gm(), vm = [
		...Af,
		pp,
		Wf,
		Hf,
		Kf,
		Rf,
		hm,
		Hp,
		Wp,
		Jp,
		Ap,
		Bf,
		Jf,
		Nf
	], ym = [...jf, bp], bm = [
		Zl,
		Jl,
		Ul
	], xm = [], Sm = [], Cm = [], h.handleByNamedList(f.WebGPUSystem, xm), h.handleByNamedList(f.WebGPUPipes, Sm), h.handleByNamedList(f.WebGPUPipesAdaptor, Cm), h.add(...vm, ...ym, ...bm), wm = class extends Mc {
		constructor() {
			let e = {
				name: "webgpu",
				type: bo.WEBGPU,
				systems: xm,
				renderPipes: Sm,
				renderPipeAdaptors: Cm
			};
			super(e);
		}
	};
})), Em, Dm = o((() => {
	g(), R(), wl(), Dl(), Fl(), zl(), Hl(), sd(), jo(), ko(), Em = class {
		contextChange(e) {
			let t = new Oo({
				uColor: {
					value: new Float32Array([
						1,
						1,
						1,
						1
					]),
					type: "vec4<f32>"
				},
				uTransformMatrix: {
					value: new L(),
					type: "mat3x3<f32>"
				},
				uRound: {
					value: 0,
					type: "f32"
				}
			}), n = e.limits.maxBatchableTextures;
			this.shader = new Ao({
				glProgram: Cl({
					name: "graphics",
					bits: [
						El,
						Ml(n),
						Rl,
						Vl
					]
				}),
				resources: {
					localUniforms: t,
					batchSamplers: ad(n)
				}
			});
		}
		execute(e, t) {
			let n = t.context, r = n.customShader || this.shader, i = e.renderer, { batcher: a, instructions: o } = i.graphicsContext.getContextRenderData(n);
			r.groups[0] = i.globalUniforms.bindGroup, i.state.set(e.state), i.shader.bind(r), i.geometry.bind(a.geometry, r.glProgram);
			let s = o.instructions;
			for (let e = 0; e < o.instructionSize; e++) {
				let t = s[e];
				if (t.size) {
					for (let e = 0; e < t.textures.count; e++) i.texture.bind(t.textures.textures[e], e);
					i.geometry.draw(t.topology, t.size, t.start);
				}
			}
		}
		destroy() {
			this.shader.destroy(!0), this.shader = null;
		}
	}, Em.extension = {
		type: [f.WebGLPipesAdaptor],
		name: "graphics"
	};
})), Om, km = o((() => {
	g(), R(), wl(), zl(), Hl(), ql(), jo(), q(), U(), Om = class {
		init() {
			this._shader = new Ao({
				glProgram: Cl({
					name: "mesh",
					bits: [
						Rl,
						Kl,
						Vl
					]
				}),
				resources: {
					uTexture: K.EMPTY.source,
					textureUniforms: { uTextureMatrix: {
						type: "mat3x3<f32>",
						value: new L()
					} }
				}
			});
		}
		execute(e, t) {
			let n = e.renderer, r = t._shader;
			if (!r) {
				r = this._shader;
				let e = t.texture, n = e.source;
				r.resources.uTexture = n, r.resources.uSampler = n.style, r.resources.textureUniforms.uniforms.uTextureMatrix = e.textureMatrix.mapCoord;
			} else if (!r.glProgram) {
				H("Mesh shader has no glProgram", t.shader);
				return;
			}
			r.groups[100] = n.globalUniforms.bindGroup, r.groups[101] = e.localUniformsBindGroup, n.encoder.draw({
				geometry: t._geometry,
				shader: r,
				state: t.state
			});
		}
		destroy() {
			this._shader.destroy(!0), this._shader = null;
		}
	}, Om.extension = {
		type: [f.WebGLPipesAdaptor],
		name: "mesh"
	};
})), Am, jm = o((() => {
	g(), Vo(), Am = class {
		constructor() {
			this._tempState = Bo.for2d(), this._didUploadHash = {};
		}
		init(e) {
			e.renderer.runners.contextChange.add(this);
		}
		contextChange() {
			this._didUploadHash = {};
		}
		start(e, t, n) {
			let r = e.renderer, i = this._didUploadHash[n.uid];
			r.shader.bind(n, i), i || (this._didUploadHash[n.uid] = !0), r.shader.updateUniformGroup(r.globalUniforms.uniformGroup), r.geometry.bind(t, n.glProgram);
		}
		execute(e, t) {
			let n = e.renderer;
			this._tempState.blendMode = t.blendMode, n.state.set(this._tempState);
			let r = t.textures.textures;
			for (let e = 0; e < t.textures.count; e++) n.texture.bind(r[e], e);
			n.geometry.draw(t.topology, t.size, t.start);
		}
	}, Am.extension = {
		type: [f.WebGLPipesAdaptor],
		name: "batch"
	};
})), Mm, Nm = o((() => {
	Mm = /* @__PURE__ */ ((e) => (e[e.ELEMENT_ARRAY_BUFFER = 34963] = "ELEMENT_ARRAY_BUFFER", e[e.ARRAY_BUFFER = 34962] = "ARRAY_BUFFER", e[e.UNIFORM_BUFFER = 35345] = "UNIFORM_BUFFER", e))(Mm || {});
})), Pm, Fm = o((() => {
	Pm = class {
		constructor(e, t) {
			this._lastBindBaseLocation = -1, this._lastBindCallId = -1, this.buffer = e || null, this.updateID = -1, this.byteLength = -1, this.type = t;
		}
		destroy() {
			this.buffer = null, this.updateID = -1, this.byteLength = -1, this.type = -1, this._lastBindBaseLocation = -1, this._lastBindCallId = -1;
		}
	};
})), Im, Lm = o((() => {
	g(), If(), $o(), Nm(), Fm(), Im = class {
		constructor(e) {
			this._boundBufferBases = /* @__PURE__ */ Object.create(null), this._minBaseLocation = 0, this._nextBindBaseIndex = this._minBaseLocation, this._bindCallId = 0, this._renderer = e, this._managedBuffers = new Ff({
				renderer: e,
				type: "resource",
				onUnload: this.onBufferUnload.bind(this),
				name: "glBuffer"
			});
		}
		destroy() {
			this._managedBuffers.destroy(), this._renderer = null, this._gl = null, this._boundBufferBases = {};
		}
		contextChange() {
			this._gl = this._renderer.gl, this.destroyAll(!0), this._maxBindings = this._renderer.limits.maxUniformBindings;
		}
		getGlBuffer(e) {
			return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid] || this.createGLBuffer(e);
		}
		bind(e) {
			let { _gl: t } = this, n = this.getGlBuffer(e);
			t.bindBuffer(n.type, n.buffer);
		}
		bindBufferBase(e, t) {
			let { _gl: n } = this;
			this._boundBufferBases[t] !== e && (this._boundBufferBases[t] = e, e._lastBindBaseLocation = t, n.bindBufferBase(n.UNIFORM_BUFFER, t, e.buffer));
		}
		nextBindBase(e) {
			this._bindCallId++, this._minBaseLocation = 0, e && (this._boundBufferBases[0] = null, this._minBaseLocation = 1, this._nextBindBaseIndex < 1 && (this._nextBindBaseIndex = 1));
		}
		freeLocationForBufferBase(e) {
			let t = this.getLastBindBaseLocation(e);
			if (t >= this._minBaseLocation) return e._lastBindCallId = this._bindCallId, t;
			let n = 0, r = this._nextBindBaseIndex;
			for (; n < 2;) {
				r >= this._maxBindings && (r = this._minBaseLocation, n++);
				let e = this._boundBufferBases[r];
				if (e && e._lastBindCallId === this._bindCallId) {
					r++;
					continue;
				}
				break;
			}
			return t = r, this._nextBindBaseIndex = r + 1, n >= 2 ? -1 : (e._lastBindCallId = this._bindCallId, this._boundBufferBases[t] = null, t);
		}
		getLastBindBaseLocation(e) {
			let t = e._lastBindBaseLocation;
			return this._boundBufferBases[t] === e ? t : -1;
		}
		bindBufferRange(e, t, n, r) {
			let { _gl: i } = this;
			n || (n = 0), t || (t = 0), this._boundBufferBases[t] = null, i.bindBufferRange(i.UNIFORM_BUFFER, t || 0, e.buffer, n * 256, r || 256);
		}
		updateBuffer(e) {
			let { _gl: t } = this, n = this.getGlBuffer(e);
			if (e._updateID === n.updateID) return n;
			n.updateID = e._updateID, t.bindBuffer(n.type, n.buffer);
			let r = e.data, i = e.descriptor.usage & X.STATIC ? t.STATIC_DRAW : t.DYNAMIC_DRAW;
			return r ? n.byteLength >= r.byteLength ? t.bufferSubData(n.type, 0, r, 0, e._updateSize / r.BYTES_PER_ELEMENT) : (n.byteLength = r.byteLength, t.bufferData(n.type, r, i)) : (n.byteLength = e.descriptor.size, t.bufferData(n.type, n.byteLength, i)), n;
		}
		destroyAll(e = !1) {
			this._managedBuffers.removeAll(e);
		}
		onBufferUnload(e, t = !1) {
			let n = e._gpuData[this._renderer.uid];
			n && (t || this._gl.deleteBuffer(n.buffer));
		}
		createGLBuffer(e) {
			let { _gl: t } = this, n = Mm.ARRAY_BUFFER;
			e.descriptor.usage & X.INDEX ? n = Mm.ELEMENT_ARRAY_BUFFER : e.descriptor.usage & X.UNIFORM && (n = Mm.UNIFORM_BUFFER);
			let r = new Pm(t.createBuffer(), n);
			return e._gpuData[this._renderer.uid] = r, this._managedBuffers.add(e), r;
		}
		resetState() {
			this._boundBufferBases = /* @__PURE__ */ Object.create(null);
		}
	}, Im.extension = {
		type: [f.WebGLSystem],
		name: "buffer"
	};
})), Rm, zm, Bm = o((() => {
	Y(), g(), U(), Rm = class e {
		constructor(e) {
			this.supports = {
				uint32Indices: !0,
				uniformBufferObject: !0,
				vertexArrayObject: !0,
				srgbTextures: !0,
				nonPowOf2wrapping: !0,
				msaa: !0,
				nonPowOf2mipmaps: !0
			}, this._renderer = e, this.extensions = /* @__PURE__ */ Object.create(null), this.handleContextLost = this.handleContextLost.bind(this), this.handleContextRestored = this.handleContextRestored.bind(this);
		}
		get isLost() {
			return !this.gl || this.gl.isContextLost();
		}
		contextChange(e) {
			this.gl = e, this._renderer.gl = e;
		}
		init(t) {
			t = {
				...e.defaultOptions,
				...t
			};
			let n = this.multiView = t.multiView;
			if (t.context && n && (H("Renderer created with both a context and multiview enabled. Disabling multiView as both cannot work together."), n = !1), n ? this.canvas = J.get().createCanvas(this._renderer.canvas.width, this._renderer.canvas.height) : this.canvas = this._renderer.view.canvas, t.context) this.initFromContext(t.context);
			else {
				let e = this._renderer.background.alpha < 1, n = t.premultipliedAlpha ?? !0, r = t.antialias && !this._renderer.backBuffer.useBackBuffer;
				this.createContext(t.preferWebGLVersion, {
					alpha: e,
					premultipliedAlpha: n,
					antialias: r,
					stencil: !0,
					preserveDrawingBuffer: t.preserveDrawingBuffer,
					powerPreference: t.powerPreference ?? "default"
				});
			}
		}
		ensureCanvasSize(e) {
			if (!this.multiView) {
				e !== this.canvas && H("multiView is disabled, but targetCanvas is not the main canvas");
				return;
			}
			let { canvas: t } = this;
			(t.width < e.width || t.height < e.height) && (t.width = Math.max(e.width, e.width), t.height = Math.max(e.height, e.height));
		}
		initFromContext(e) {
			this.gl = e, this.webGLVersion = e instanceof J.get().getWebGLRenderingContext() ? 1 : 2, this.getExtensions(), this.validateContext(e), this._renderer.runners.contextChange.emit(e);
			let t = this._renderer.view.canvas;
			t.addEventListener("webglcontextlost", this.handleContextLost, !1), t.addEventListener("webglcontextrestored", this.handleContextRestored, !1);
		}
		createContext(e, t) {
			let n, r = this.canvas;
			if (e === 2 && (n = r.getContext("webgl2", t)), !n && (n = r.getContext("webgl", t), !n)) throw Error("This browser does not support WebGL. Try using the canvas renderer");
			this.gl = n, this.initFromContext(this.gl);
		}
		getExtensions() {
			let { gl: e } = this, t = {
				anisotropicFiltering: e.getExtension("EXT_texture_filter_anisotropic"),
				floatTextureLinear: e.getExtension("OES_texture_float_linear"),
				s3tc: e.getExtension("WEBGL_compressed_texture_s3tc"),
				s3tc_sRGB: e.getExtension("WEBGL_compressed_texture_s3tc_srgb"),
				etc: e.getExtension("WEBGL_compressed_texture_etc"),
				etc1: e.getExtension("WEBGL_compressed_texture_etc1"),
				pvrtc: e.getExtension("WEBGL_compressed_texture_pvrtc") || e.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc"),
				atc: e.getExtension("WEBGL_compressed_texture_atc"),
				astc: e.getExtension("WEBGL_compressed_texture_astc"),
				bptc: e.getExtension("EXT_texture_compression_bptc"),
				rgtc: e.getExtension("EXT_texture_compression_rgtc"),
				loseContext: e.getExtension("WEBGL_lose_context")
			};
			if (this.webGLVersion === 1) this.extensions = {
				...t,
				drawBuffers: e.getExtension("WEBGL_draw_buffers"),
				depthTexture: e.getExtension("WEBGL_depth_texture"),
				vertexArrayObject: e.getExtension("OES_vertex_array_object") || e.getExtension("MOZ_OES_vertex_array_object") || e.getExtension("WEBKIT_OES_vertex_array_object"),
				uint32ElementIndex: e.getExtension("OES_element_index_uint"),
				floatTexture: e.getExtension("OES_texture_float"),
				floatTextureLinear: e.getExtension("OES_texture_float_linear"),
				textureHalfFloat: e.getExtension("OES_texture_half_float"),
				textureHalfFloatLinear: e.getExtension("OES_texture_half_float_linear"),
				vertexAttribDivisorANGLE: e.getExtension("ANGLE_instanced_arrays"),
				srgb: e.getExtension("EXT_sRGB")
			};
			else {
				this.extensions = {
					...t,
					colorBufferFloat: e.getExtension("EXT_color_buffer_float")
				};
				let n = e.getExtension("WEBGL_provoking_vertex");
				n && n.provokingVertexWEBGL(n.FIRST_VERTEX_CONVENTION_WEBGL);
			}
		}
		handleContextLost(e) {
			e.preventDefault(), this._contextLossForced && (this._contextLossForced = !1, setTimeout(() => {
				this.gl.isContextLost() && this.extensions.loseContext?.restoreContext();
			}, 0));
		}
		handleContextRestored() {
			this.getExtensions(), this._renderer.runners.contextChange.emit(this.gl);
		}
		destroy() {
			let e = this._renderer.view.canvas;
			this._renderer = null, e.removeEventListener("webglcontextlost", this.handleContextLost), e.removeEventListener("webglcontextrestored", this.handleContextRestored), this.gl.useProgram(null), this.extensions.loseContext?.loseContext();
		}
		forceContextLoss() {
			this.extensions.loseContext?.loseContext(), this._contextLossForced = !0;
		}
		validateContext(e) {
			let t = e.getContextAttributes();
			t && !t.stencil && H("Provided WebGL context does not have a stencil buffer, masks may not render correctly");
			let n = this.supports, r = this.webGLVersion === 2, i = this.extensions;
			n.uint32Indices = r || !!i.uint32ElementIndex, n.uniformBufferObject = r, n.vertexArrayObject = r || !!i.vertexArrayObject, n.srgbTextures = r || !!i.srgb, n.nonPowOf2wrapping = r, n.nonPowOf2mipmaps = r, n.msaa = r, n.uint32Indices || H("Provided WebGL context does not support 32 index buffer, large scenes may not render correctly");
		}
	}, Rm.extension = {
		type: [f.WebGLSystem],
		name: "context"
	}, Rm.defaultOptions = {
		context: null,
		premultipliedAlpha: !0,
		preserveDrawingBuffer: !1,
		powerPreference: void 0,
		preferWebGLVersion: 2,
		multiView: !1
	}, zm = Rm;
})), Vm, Hm, Z, Um = o((() => {
	Vm = /* @__PURE__ */ ((e) => (e[e.RGBA = 6408] = "RGBA", e[e.RGB = 6407] = "RGB", e[e.RG = 33319] = "RG", e[e.RED = 6403] = "RED", e[e.RGBA_INTEGER = 36249] = "RGBA_INTEGER", e[e.RGB_INTEGER = 36248] = "RGB_INTEGER", e[e.RG_INTEGER = 33320] = "RG_INTEGER", e[e.RED_INTEGER = 36244] = "RED_INTEGER", e[e.ALPHA = 6406] = "ALPHA", e[e.LUMINANCE = 6409] = "LUMINANCE", e[e.LUMINANCE_ALPHA = 6410] = "LUMINANCE_ALPHA", e[e.DEPTH_COMPONENT = 6402] = "DEPTH_COMPONENT", e[e.DEPTH_STENCIL = 34041] = "DEPTH_STENCIL", e))(Vm || {}), Hm = /* @__PURE__ */ ((e) => (e[e.TEXTURE_2D = 3553] = "TEXTURE_2D", e[e.TEXTURE_CUBE_MAP = 34067] = "TEXTURE_CUBE_MAP", e[e.TEXTURE_2D_ARRAY = 35866] = "TEXTURE_2D_ARRAY", e[e.TEXTURE_CUBE_MAP_POSITIVE_X = 34069] = "TEXTURE_CUBE_MAP_POSITIVE_X", e[e.TEXTURE_CUBE_MAP_NEGATIVE_X = 34070] = "TEXTURE_CUBE_MAP_NEGATIVE_X", e[e.TEXTURE_CUBE_MAP_POSITIVE_Y = 34071] = "TEXTURE_CUBE_MAP_POSITIVE_Y", e[e.TEXTURE_CUBE_MAP_NEGATIVE_Y = 34072] = "TEXTURE_CUBE_MAP_NEGATIVE_Y", e[e.TEXTURE_CUBE_MAP_POSITIVE_Z = 34073] = "TEXTURE_CUBE_MAP_POSITIVE_Z", e[e.TEXTURE_CUBE_MAP_NEGATIVE_Z = 34074] = "TEXTURE_CUBE_MAP_NEGATIVE_Z", e))(Hm || {}), Z = /* @__PURE__ */ ((e) => (e[e.UNSIGNED_BYTE = 5121] = "UNSIGNED_BYTE", e[e.UNSIGNED_SHORT = 5123] = "UNSIGNED_SHORT", e[e.UNSIGNED_SHORT_5_6_5 = 33635] = "UNSIGNED_SHORT_5_6_5", e[e.UNSIGNED_SHORT_4_4_4_4 = 32819] = "UNSIGNED_SHORT_4_4_4_4", e[e.UNSIGNED_SHORT_5_5_5_1 = 32820] = "UNSIGNED_SHORT_5_5_5_1", e[e.UNSIGNED_INT = 5125] = "UNSIGNED_INT", e[e.UNSIGNED_INT_10F_11F_11F_REV = 35899] = "UNSIGNED_INT_10F_11F_11F_REV", e[e.UNSIGNED_INT_2_10_10_10_REV = 33640] = "UNSIGNED_INT_2_10_10_10_REV", e[e.UNSIGNED_INT_24_8 = 34042] = "UNSIGNED_INT_24_8", e[e.UNSIGNED_INT_5_9_9_9_REV = 35902] = "UNSIGNED_INT_5_9_9_9_REV", e[e.BYTE = 5120] = "BYTE", e[e.SHORT = 5122] = "SHORT", e[e.INT = 5124] = "INT", e[e.FLOAT = 5126] = "FLOAT", e[e.FLOAT_32_UNSIGNED_INT_24_8_REV = 36269] = "FLOAT_32_UNSIGNED_INT_24_8_REV", e[e.HALF_FLOAT = 36193] = "HALF_FLOAT", e))(Z || {});
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/geometry/utils/getGlTypeFromFormat.mjs
function Wm(e) {
	return Gm[e] ?? Gm.float32;
}
var Gm, Km = o((() => {
	Um(), Gm = {
		uint8x2: Z.UNSIGNED_BYTE,
		uint8x4: Z.UNSIGNED_BYTE,
		sint8x2: Z.BYTE,
		sint8x4: Z.BYTE,
		unorm8x2: Z.UNSIGNED_BYTE,
		unorm8x4: Z.UNSIGNED_BYTE,
		snorm8x2: Z.BYTE,
		snorm8x4: Z.BYTE,
		uint16x2: Z.UNSIGNED_SHORT,
		uint16x4: Z.UNSIGNED_SHORT,
		sint16x2: Z.SHORT,
		sint16x4: Z.SHORT,
		unorm16x2: Z.UNSIGNED_SHORT,
		unorm16x4: Z.UNSIGNED_SHORT,
		snorm16x2: Z.SHORT,
		snorm16x4: Z.SHORT,
		float16x2: Z.HALF_FLOAT,
		float16x4: Z.HALF_FLOAT,
		float32: Z.FLOAT,
		float32x2: Z.FLOAT,
		float32x3: Z.FLOAT,
		float32x4: Z.FLOAT,
		uint32: Z.UNSIGNED_INT,
		uint32x2: Z.UNSIGNED_INT,
		uint32x3: Z.UNSIGNED_INT,
		uint32x4: Z.UNSIGNED_INT,
		sint32: Z.INT,
		sint32x2: Z.INT,
		sint32x3: Z.INT,
		sint32x4: Z.INT
	};
})), qm, Jm, Ym, Xm = o((() => {
	g(), If(), Za(), wp(), Km(), qm = {
		"point-list": 0,
		"line-list": 1,
		"line-strip": 3,
		"triangle-list": 4,
		"triangle-strip": 5
	}, Jm = class {
		constructor() {
			this.vaoCache = /* @__PURE__ */ Object.create(null);
		}
		destroy() {
			this.vaoCache = /* @__PURE__ */ Object.create(null);
		}
	}, Ym = class {
		constructor(e) {
			this._renderer = e, this._activeGeometry = null, this._activeVao = null, this.hasVao = !0, this.hasInstance = !0, this._managedGeometries = new Ff({
				renderer: e,
				type: "resource",
				onUnload: this.onGeometryUnload.bind(this),
				name: "glGeometry"
			});
		}
		contextChange() {
			let e = this.gl = this._renderer.gl;
			if (!this._renderer.context.supports.vertexArrayObject) throw Error("[PixiJS] Vertex Array Objects are not supported on this device");
			this.destroyAll(!0);
			let t = this._renderer.context.extensions.vertexArrayObject;
			t && (e.createVertexArray = () => t.createVertexArrayOES(), e.bindVertexArray = (e) => t.bindVertexArrayOES(e), e.deleteVertexArray = (e) => t.deleteVertexArrayOES(e));
			let n = this._renderer.context.extensions.vertexAttribDivisorANGLE;
			n && (e.drawArraysInstanced = (e, t, r, i) => {
				n.drawArraysInstancedANGLE(e, t, r, i);
			}, e.drawElementsInstanced = (e, t, r, i, a) => {
				n.drawElementsInstancedANGLE(e, t, r, i, a);
			}, e.vertexAttribDivisor = (e, t) => n.vertexAttribDivisorANGLE(e, t)), this._activeGeometry = null, this._activeVao = null;
		}
		bind(e, t) {
			let n = this.gl;
			this._activeGeometry = e;
			let r = this.getVao(e, t);
			this._activeVao !== r && (this._activeVao = r, n.bindVertexArray(r)), this.updateBuffers();
		}
		resetState() {
			this.unbind();
		}
		updateBuffers() {
			let e = this._activeGeometry, t = this._renderer.buffer;
			for (let n = 0; n < e.buffers.length; n++) {
				let r = e.buffers[n];
				t.updateBuffer(r);
			}
			e._gcLastUsed = this._renderer.gc.now;
		}
		checkCompatibility(e, t) {
			let n = e.attributes, r = t._attributeData;
			for (let e in r) if (!n[e]) throw Error(`shader and geometry incompatible, geometry missing the "${e}" attribute`);
		}
		getSignature(e, t) {
			let n = e.attributes, r = t._attributeData, i = ["g", e.uid];
			for (let e in n) r[e] && i.push(e, r[e].location);
			return i.join("-");
		}
		getVao(e, t) {
			return e._gpuData[this._renderer.uid]?.vaoCache[t._key] || this.initGeometryVao(e, t);
		}
		initGeometryVao(e, t, n = !0) {
			let r = this._renderer.gl, i = this._renderer.buffer;
			this._renderer.shader._getProgramData(t), this.checkCompatibility(e, t);
			let a = this.getSignature(e, t), o = e._gpuData[this._renderer.uid];
			o || (o = new Jm(), e._gpuData[this._renderer.uid] = o, this._managedGeometries.add(e));
			let s = o.vaoCache, c = s[a];
			if (c) return s[t._key] = c, c;
			Sp(e, t._attributeData);
			let l = e.buffers;
			c = r.createVertexArray(), r.bindVertexArray(c);
			for (let e = 0; e < l.length; e++) {
				let t = l[e];
				i.bind(t);
			}
			return this.activateVao(e, t), s[t._key] = c, s[a] = c, r.bindVertexArray(null), c;
		}
		onGeometryUnload(e, t = !1) {
			let n = e._gpuData[this._renderer.uid];
			if (!n) return;
			let r = n.vaoCache;
			if (!t) for (let e in r) this._activeVao !== r[e] && this.resetState(), this.gl.deleteVertexArray(r[e]);
		}
		destroyAll(e = !1) {
			this._managedGeometries.removeAll(e);
		}
		activateVao(e, t) {
			let n = this._renderer.gl, r = this._renderer.buffer, i = e.attributes;
			e.indexBuffer && r.bind(e.indexBuffer);
			let a = null;
			for (let e in i) {
				let o = i[e], s = o.buffer, c = r.getGlBuffer(s), l = t._attributeData[e];
				if (l) {
					a !== c && (r.bind(s), a = c);
					let e = l.location;
					n.enableVertexAttribArray(e);
					let t = Ya(o.format), i = Wm(o.format);
					if (l.format?.substring(1, 4) === "int" ? n.vertexAttribIPointer(e, t.size, i, o.stride, o.offset) : n.vertexAttribPointer(e, t.size, i, t.normalised, o.stride, o.offset), o.instance) if (this.hasInstance) {
						let t = o.divisor ?? 1;
						n.vertexAttribDivisor(e, t);
					} else throw Error("geometry error, GPU Instancing is not supported on this device");
				}
			}
		}
		draw(e, t, n, r) {
			let { gl: i } = this._renderer, a = this._activeGeometry, o = qm[e || a.topology];
			if (r ?? (r = a.instanceCount), a.indexBuffer) {
				let e = a.indexBuffer.data.BYTES_PER_ELEMENT, s = e === 2 ? i.UNSIGNED_SHORT : i.UNSIGNED_INT;
				r === 1 ? i.drawElements(o, t || a.indexBuffer.data.length, s, (n || 0) * e) : i.drawElementsInstanced(o, t || a.indexBuffer.data.length, s, (n || 0) * e, r);
			} else r === 1 ? i.drawArrays(o, n || 0, t || a.getSize()) : i.drawArraysInstanced(o, n || 0, t || a.getSize(), r);
			return this;
		}
		unbind() {
			this.gl.bindVertexArray(null), this._activeVao = null, this._activeGeometry = null;
		}
		destroy() {
			this._managedGeometries.destroy(), this._renderer = null, this.gl = null, this._activeVao = null, this._activeGeometry = null;
		}
	}, Ym.extension = {
		type: [f.WebGLSystem],
		name: "geometry"
	};
})), Zm, Qm, $m, eh = o((() => {
	g(), U(), cs(), jo(), Vo(), ln(), q(), Ja(), Zm = new ss({ attributes: { aPosition: [
		-1,
		-1,
		3,
		-1,
		-1,
		3
	] } }), Qm = class e {
		constructor(e) {
			this.useBackBuffer = !1, this._useBackBufferThisRender = !1, this._renderer = e;
		}
		init(t = {}) {
			let { useBackBuffer: n, antialias: r } = {
				...e.defaultOptions,
				...t
			};
			this.useBackBuffer = n, this._antialias = r, this._renderer.context.supports.msaa || (H("antialiasing, is not supported on when using the back buffer"), this._antialias = !1), this._state = Bo.for2d(), this._bigTriangleShader = new Ao({
				glProgram: new qa({
					vertex: "\n                attribute vec2 aPosition;\n                out vec2 vUv;\n\n                void main() {\n                    gl_Position = vec4(aPosition, 0.0, 1.0);\n\n                    vUv = (aPosition + 1.0) / 2.0;\n\n                    // flip dem UVs\n                    vUv.y = 1.0 - vUv.y;\n                }",
					fragment: "\n                in vec2 vUv;\n                out vec4 finalColor;\n\n                uniform sampler2D uTexture;\n\n                void main() {\n                    finalColor = texture(uTexture, vUv);\n                }",
					name: "big-triangle"
				}),
				resources: { uTexture: K.WHITE.source }
			});
		}
		renderStart(e) {
			let t = this._renderer.renderTarget.getRenderTarget(e.target);
			if (this._useBackBufferThisRender = this.useBackBuffer && !!t.isRoot, this._useBackBufferThisRender) {
				let t = this._renderer.renderTarget.getRenderTarget(e.target);
				this._targetTexture = t.colorTexture, e.target = this._getBackBufferTexture(t.colorTexture);
			}
		}
		renderEnd() {
			this._presentBackBuffer();
		}
		_presentBackBuffer() {
			let e = this._renderer;
			e.renderTarget.finishRenderPass(), this._useBackBufferThisRender && (e.renderTarget.bind(this._targetTexture, !1), this._bigTriangleShader.resources.uTexture = this._backBufferTexture.source, e.encoder.draw({
				geometry: Zm,
				shader: this._bigTriangleShader,
				state: this._state
			}));
		}
		_getBackBufferTexture(e) {
			return this._backBufferTexture = this._backBufferTexture || new K({ source: new cn({
				width: e.width,
				height: e.height,
				resolution: e._resolution,
				antialias: this._antialias
			}) }), this._backBufferTexture.source.resize(e.width, e.height, e._resolution), this._backBufferTexture;
		}
		destroy() {
			this._backBufferTexture && (this._backBufferTexture.destroy(), this._backBufferTexture = null);
		}
	}, Qm.extension = {
		type: [f.WebGLSystem],
		name: "backBuffer",
		priority: 1
	}, Qm.defaultOptions = { useBackBuffer: !1 }, $m = Qm;
})), th, nh = o((() => {
	g(), th = class {
		constructor(e) {
			this._colorMaskCache = 15, this._renderer = e;
		}
		setMask(e) {
			this._colorMaskCache !== e && (this._colorMaskCache = e, this._renderer.gl.colorMask(!!(e & 8), !!(e & 4), !!(e & 2), !!(e & 1)));
		}
	}, th.extension = {
		type: [f.WebGLSystem],
		name: "colorMask"
	};
})), rh, ih = o((() => {
	g(), rh = class {
		constructor(e) {
			this.commandFinished = Promise.resolve(), this._renderer = e;
		}
		setGeometry(e, t) {
			this._renderer.geometry.bind(e, t.glProgram);
		}
		finishRenderPass() {}
		draw(e) {
			let t = this._renderer, { geometry: n, shader: r, state: i, skipSync: a, topology: o, size: s, start: c, instanceCount: l } = e;
			t.shader.bind(r, a), t.geometry.bind(n, t.shader._activeProgram), i && t.state.set(i), t.geometry.draw(o, s, c, l ?? n.instanceCount);
		}
		destroy() {
			this._renderer = null;
		}
	}, rh.extension = {
		type: [f.WebGLSystem],
		name: "encoder"
	};
})), ah, oh = o((() => {
	g(), Bu(), ah = class {
		constructor(e) {
			this._renderer = e;
		}
		contextChange() {
			let e = this._renderer.gl;
			this.maxTextures = e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS), this.maxBatchableTextures = Ru(this.maxTextures, e), this.maxUniformBindings = this._renderer.context.webGLVersion === 2 ? e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS) : 0;
		}
		destroy() {}
	}, ah.extension = {
		type: [f.WebGLSystem],
		name: "limits"
	};
})), sh, ch = o((() => {
	g(), Ep(), Pu(), sh = class {
		constructor(e) {
			this._stencilCache = {
				enabled: !1,
				stencilReference: 0,
				stencilMode: Nu.NONE
			}, this._renderTargetStencilState = /* @__PURE__ */ Object.create(null), e.renderTarget.onRenderTargetChange.add(this);
		}
		contextChange(e) {
			this._gl = e, this._comparisonFuncMapping = {
				always: e.ALWAYS,
				never: e.NEVER,
				equal: e.EQUAL,
				"not-equal": e.NOTEQUAL,
				less: e.LESS,
				"less-equal": e.LEQUAL,
				greater: e.GREATER,
				"greater-equal": e.GEQUAL
			}, this._stencilOpsMapping = {
				keep: e.KEEP,
				zero: e.ZERO,
				replace: e.REPLACE,
				invert: e.INVERT,
				"increment-clamp": e.INCR,
				"decrement-clamp": e.DECR,
				"increment-wrap": e.INCR_WRAP,
				"decrement-wrap": e.DECR_WRAP
			}, this.resetState();
		}
		onRenderTargetChange(e) {
			if (this._activeRenderTarget === e) return;
			this._activeRenderTarget = e;
			let t = this._renderTargetStencilState[e.uid];
			t || (t = this._renderTargetStencilState[e.uid] = {
				stencilMode: Nu.DISABLED,
				stencilReference: 0
			}), this.setStencilMode(t.stencilMode, t.stencilReference);
		}
		resetState() {
			this._stencilCache.enabled = !1, this._stencilCache.stencilMode = Nu.NONE, this._stencilCache.stencilReference = 0;
		}
		setStencilMode(e, t) {
			let n = this._renderTargetStencilState[this._activeRenderTarget.uid], r = this._gl, i = Tp[e], a = this._stencilCache;
			if (n.stencilMode = e, n.stencilReference = t, e === Nu.DISABLED) {
				this._stencilCache.enabled && (this._stencilCache.enabled = !1, r.disable(r.STENCIL_TEST));
				return;
			}
			this._stencilCache.enabled || (this._stencilCache.enabled = !0, r.enable(r.STENCIL_TEST)), (e !== a.stencilMode || a.stencilReference !== t) && (a.stencilMode = e, a.stencilReference = t, r.stencilFunc(this._comparisonFuncMapping[i.stencilBack.compare], t, 255), r.stencilOp(r.KEEP, r.KEEP, this._stencilOpsMapping[i.stencilBack.passOp]));
		}
	}, sh.extension = {
		type: [f.WebGLSystem],
		name: "stencil"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/utils/createUboElementsSTD40.mjs
function lh(e) {
	let t = e.map((e) => ({
		data: e,
		offset: 0,
		size: 0
	})), n = 0, r = 0;
	for (let e = 0; e < t.length; e++) {
		let i = t[e];
		if (n = uh[i.data.type], !n) throw Error(`Unknown type ${i.data.type}`);
		i.data.size > 1 && (n = Math.max(n, 16) * i.data.size);
		let a = n === 12 ? 16 : n;
		i.size = n;
		let o = r % 16;
		o > 0 && 16 - o < a ? r += (16 - o) % 16 : r += (n - o % n) % n, i.offset = r, r += n;
	}
	return r = Math.ceil(r / 16) * 16, {
		uboElements: t,
		size: r
	};
}
var uh, dh = o((() => {
	uh = {
		f32: 4,
		i32: 4,
		"vec2<f32>": 8,
		"vec3<f32>": 12,
		"vec4<f32>": 16,
		"vec2<i32>": 8,
		"vec3<i32>": 12,
		"vec4<i32>": 16,
		"mat2x2<f32>": 32,
		"mat3x3<f32>": 48,
		"mat4x4<f32>": 64
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/utils/generateArraySyncSTD40.mjs
function fh(e, t) {
	let n = Math.max(uh[e.data.type] / 16, 1), r = e.data.value.length / e.data.size, i = (4 - r % 4) % 4, a = e.data.type.indexOf("i32") >= 0 ? "dataInt32" : "data";
	return `
        v = uv.${e.data.name};
        offset += ${t};

        arrayOffset = offset;

        t = 0;

        for(var i=0; i < ${e.data.size * n}; i++)
        {
            for(var j = 0; j < ${r}; j++)
            {
                ${a}[arrayOffset++] = v[t++];
            }
            ${i === 0 ? "" : `arrayOffset += ${i};`}
        }
    `;
}
var ph = o((() => {
	dh();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/utils/createUboSyncSTD40.mjs
function mh(e) {
	return rp(e, "uboStd40", fh, op);
}
var hh = o((() => {
	ip(), cp(), ph();
})), gh, _h = o((() => {
	g(), Zf(), dh(), hh(), gh = class extends Xf {
		constructor() {
			super({
				createUboElements: lh,
				generateUboSync: mh
			});
		}
	}, gh.extension = {
		type: [f.WebGLSystem],
		name: "ubo"
	};
})), vh, yh = o((() => {
	vh = class {
		constructor() {
			this.width = -1, this.height = -1, this.msaa = !1, this._attachedMipLevel = 0, this._attachedLayer = 0, this.msaaRenderBuffer = [];
		}
	};
})), bh, xh = o((() => {
	dt(), U(), na(), Dc(), yh(), bh = class {
		constructor() {
			this._clearColorCache = [
				0,
				0,
				0,
				0
			], this._viewPortCache = new W();
		}
		init(e, t) {
			this._renderer = e, this._renderTargetSystem = t, e.runners.contextChange.add(this);
		}
		contextChange() {
			this._clearColorCache = [
				0,
				0,
				0,
				0
			], this._viewPortCache = new W();
			let e = this._renderer.gl;
			this._drawBuffersCache = [];
			for (let t = 1; t <= 16; t++) this._drawBuffersCache[t] = Array.from({ length: t }, (t, n) => e.COLOR_ATTACHMENT0 + n);
		}
		copyToTexture(e, t, n, r, i) {
			let a = this._renderTargetSystem, o = this._renderer, s = a.getGpuRenderTarget(e), c = o.gl;
			return this.finishRenderPass(e), c.bindFramebuffer(c.FRAMEBUFFER, s.resolveTargetFramebuffer), o.texture.bind(t, 0), c.copyTexSubImage2D(c.TEXTURE_2D, 0, i.x, i.y, n.x, n.y, r.width, r.height), t;
		}
		startRenderPass(e, t = !0, n, r, i = 0, a = 0) {
			let o = this._renderTargetSystem, s = e.colorTexture, c = o.getGpuRenderTarget(e);
			if (a !== 0 && this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to array layers requires WebGL2.");
			if (i > 0) {
				if (c.msaa) throw Error("[RenderTargetSystem] Rendering to mip levels is not supported with MSAA render targets.");
				if (this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to mip levels requires WebGL2.");
			}
			let l = r.y;
			e.isRoot && (l = s.pixelHeight - r.height - r.y), e.colorTextures.forEach((e) => {
				this._renderer.texture.unbind(e);
			});
			let u = this._renderer.gl;
			u.bindFramebuffer(u.FRAMEBUFFER, c.framebuffer), !e.isRoot && (c._attachedMipLevel !== i || c._attachedLayer !== a) && (e.colorTextures.forEach((e, t) => {
				let n = this._renderer.texture.getGlSource(e);
				if (n.target === u.TEXTURE_2D) {
					if (a !== 0) throw Error("[RenderTargetSystem] layer must be 0 when rendering to 2D textures in WebGL.");
					u.framebufferTexture2D(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, u.TEXTURE_2D, n.texture, i);
				} else if (n.target === u.TEXTURE_2D_ARRAY) {
					if (this._renderer.context.webGLVersion < 2) throw Error("[RenderTargetSystem] Rendering to 2D array textures requires WebGL2.");
					u.framebufferTextureLayer(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, n.texture, i, a);
				} else if (n.target === u.TEXTURE_CUBE_MAP) {
					if (a < 0 || a > 5) throw Error("[RenderTargetSystem] Cube map layer must be between 0 and 5.");
					u.framebufferTexture2D(u.FRAMEBUFFER, u.COLOR_ATTACHMENT0 + t, u.TEXTURE_CUBE_MAP_POSITIVE_X + a, n.texture, i);
				} else throw Error("[RenderTargetSystem] Unsupported texture target for render-to-layer in WebGL.");
			}), c._attachedMipLevel = i, c._attachedLayer = a), e.colorTextures.length > 1 && this._setDrawBuffers(e, u);
			let d = this._viewPortCache;
			(d.x !== r.x || d.y !== l || d.width !== r.width || d.height !== r.height) && (d.x = r.x, d.y = l, d.width = r.width, d.height = r.height, u.viewport(r.x, l, r.width, r.height)), !c.depthStencilRenderBuffer && (e.stencil || e.depth) && this._initStencil(c), this.clear(e, t, n);
		}
		finishRenderPass(e) {
			let t = this._renderTargetSystem.getGpuRenderTarget(e);
			if (!t.msaa) return;
			let n = this._renderer.gl;
			n.bindFramebuffer(n.FRAMEBUFFER, t.resolveTargetFramebuffer), n.bindFramebuffer(n.READ_FRAMEBUFFER, t.framebuffer), n.blitFramebuffer(0, 0, t.width, t.height, 0, 0, t.width, t.height, n.COLOR_BUFFER_BIT, n.NEAREST), n.bindFramebuffer(n.FRAMEBUFFER, t.framebuffer);
		}
		initGpuRenderTarget(e) {
			let t = this._renderer.gl, n = new vh();
			return n._attachedMipLevel = 0, n._attachedLayer = 0, e.colorTexture instanceof ta ? (this._renderer.context.ensureCanvasSize(e.colorTexture.resource), n.framebuffer = null, n) : (this._initColor(e, n), t.bindFramebuffer(t.FRAMEBUFFER, null), n);
		}
		destroyGpuRenderTarget(e) {
			let t = this._renderer.gl;
			e.framebuffer && (t.deleteFramebuffer(e.framebuffer), e.framebuffer = null), e.resolveTargetFramebuffer && (t.deleteFramebuffer(e.resolveTargetFramebuffer), e.resolveTargetFramebuffer = null), e.depthStencilRenderBuffer && (t.deleteRenderbuffer(e.depthStencilRenderBuffer), e.depthStencilRenderBuffer = null), e.msaaRenderBuffer.forEach((e) => {
				t.deleteRenderbuffer(e);
			}), e.msaaRenderBuffer = null;
		}
		clear(e, t, n, r, i = 0, a = 0) {
			if (!t) return;
			if (a !== 0) throw Error("[RenderTargetSystem] Clearing array layers is not supported in WebGL renderer.");
			let o = this._renderTargetSystem;
			typeof t == "boolean" && (t = t ? Ec.ALL : Ec.NONE);
			let s = this._renderer.gl;
			if (t & Ec.COLOR) {
				n ?? (n = o.defaultClearColor);
				let e = this._clearColorCache, t = n;
				(e[0] !== t[0] || e[1] !== t[1] || e[2] !== t[2] || e[3] !== t[3]) && (e[0] = t[0], e[1] = t[1], e[2] = t[2], e[3] = t[3], s.clearColor(t[0], t[1], t[2], t[3]));
			}
			s.clear(t);
		}
		resizeGpuRenderTarget(e) {
			if (e.isRoot) return;
			let t = this._renderTargetSystem.getGpuRenderTarget(e);
			this._resizeColor(e, t), (e.stencil || e.depth) && this._resizeStencil(t);
		}
		_initColor(e, t) {
			let n = this._renderer, r = n.gl, i = r.createFramebuffer();
			if (t.resolveTargetFramebuffer = i, r.bindFramebuffer(r.FRAMEBUFFER, i), t.width = e.colorTexture.source.pixelWidth, t.height = e.colorTexture.source.pixelHeight, e.colorTextures.forEach((e, i) => {
				let a = e.source;
				a.antialias && (n.context.supports.msaa ? t.msaa = !0 : H("[RenderTexture] Antialiasing on textures is not supported in WebGL1")), n.texture.bindSource(a, 0);
				let o = n.texture.getGlSource(a), s = o.texture;
				if (o.target === r.TEXTURE_2D) r.framebufferTexture2D(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.TEXTURE_2D, s, 0);
				else if (o.target === r.TEXTURE_2D_ARRAY) {
					if (n.context.webGLVersion < 2) throw Error("[RenderTargetSystem] TEXTURE_2D_ARRAY requires WebGL2.");
					r.framebufferTextureLayer(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, s, 0, 0);
				} else if (o.target === r.TEXTURE_CUBE_MAP) r.framebufferTexture2D(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.TEXTURE_CUBE_MAP_POSITIVE_X, s, 0);
				else throw Error("[RenderTargetSystem] Unsupported texture target for framebuffer attachment.");
			}), t.msaa) {
				let n = r.createFramebuffer();
				t.framebuffer = n, r.bindFramebuffer(r.FRAMEBUFFER, n), e.colorTextures.forEach((e, n) => {
					let i = r.createRenderbuffer();
					t.msaaRenderBuffer[n] = i;
				});
			} else t.framebuffer = i;
			this._resizeColor(e, t);
		}
		_resizeColor(e, t) {
			let n = e.colorTexture.source;
			if (t.width = n.pixelWidth, t.height = n.pixelHeight, t._attachedMipLevel = 0, t._attachedLayer = 0, e.colorTextures.forEach((e, t) => {
				t !== 0 && e.source.resize(n.width, n.height, n._resolution);
			}), t.msaa) {
				let n = this._renderer, r = n.gl, i = t.framebuffer;
				r.bindFramebuffer(r.FRAMEBUFFER, i), e.colorTextures.forEach((e, i) => {
					let a = e.source;
					n.texture.bindSource(a, 0);
					let o = n.texture.getGlSource(a).internalFormat, s = t.msaaRenderBuffer[i];
					r.bindRenderbuffer(r.RENDERBUFFER, s), r.renderbufferStorageMultisample(r.RENDERBUFFER, 4, o, a.pixelWidth, a.pixelHeight), r.framebufferRenderbuffer(r.FRAMEBUFFER, r.COLOR_ATTACHMENT0 + i, r.RENDERBUFFER, s);
				});
			}
		}
		_initStencil(e) {
			if (e.framebuffer === null) return;
			let t = this._renderer.gl, n = t.createRenderbuffer();
			e.depthStencilRenderBuffer = n, t.bindRenderbuffer(t.RENDERBUFFER, n), t.framebufferRenderbuffer(t.FRAMEBUFFER, t.DEPTH_STENCIL_ATTACHMENT, t.RENDERBUFFER, n), this._resizeStencil(e);
		}
		_resizeStencil(e) {
			let t = this._renderer.gl;
			t.bindRenderbuffer(t.RENDERBUFFER, e.depthStencilRenderBuffer), e.msaa ? t.renderbufferStorageMultisample(t.RENDERBUFFER, 4, t.DEPTH24_STENCIL8, e.width, e.height) : t.renderbufferStorage(t.RENDERBUFFER, this._renderer.context.webGLVersion === 2 ? t.DEPTH24_STENCIL8 : t.DEPTH_STENCIL, e.width, e.height);
		}
		prerender(e) {
			let t = e.colorTexture.resource;
			this._renderer.context.multiView && ta.test(t) && this._renderer.context.ensureCanvasSize(t);
		}
		postrender(e) {
			if (this._renderer.context.multiView && ta.test(e.colorTexture.resource)) {
				let t = this._renderer.context.canvas, n = e.colorTexture;
				n.context2D.drawImage(t, 0, n.pixelHeight - t.height);
			}
		}
		_setDrawBuffers(e, t) {
			let n = e.colorTextures.length, r = this._drawBuffersCache[n];
			if (this._renderer.context.webGLVersion === 1) {
				let e = this._renderer.context.extensions.drawBuffers;
				e ? e.drawBuffersWEBGL(r) : H("[RenderTexture] This WebGL1 context does not support rendering to multiple targets");
			} else t.drawBuffers(r);
		}
	};
})), Sh, Ch = o((() => {
	g(), Lp(), xh(), Sh = class extends Ip {
		constructor(e) {
			super(e), this.adaptor = new bh(), this.adaptor.init(e, this);
		}
	}, Sh.extension = {
		type: [f.WebGLSystem],
		name: "renderTarget"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/GenerateShaderSyncCode.mjs
function wh(e, t) {
	let n = [], r = ["\n        var g = s.groups;\n        var sS = r.shader;\n        var p = s.glProgram;\n        var ugS = r.uniformGroup;\n        var resources;\n    "], i = !1, a = 0, o = t._getProgramData(e.glProgram);
	for (let s in e.groups) {
		let c = e.groups[s];
		n.push(`
            resources = g[${s}].resources;
        `);
		for (let l in c.resources) {
			let u = c.resources[l];
			if (u instanceof Oo) if (u.ubo) {
				let t = e._uniformBindMap[s][Number(l)];
				n.push(`
                        sS.bindUniformBlock(
                            resources[${l}],
                            '${t}',
                            ${e.glProgram._uniformBlockData[t].index}
                        );
                    `);
			} else n.push(`
                        ugS.updateUniformGroup(resources[${l}], p, sD);
                    `);
			else if (u instanceof hp) {
				let t = e._uniformBindMap[s][Number(l)];
				n.push(`
                    sS.bindUniformBlock(
                        resources[${l}],
                        '${t}',
                        ${e.glProgram._uniformBlockData[t].index}
                    );
                `);
			} else if (u instanceof cn) {
				let c = e._uniformBindMap[s][l], u = o.uniformData[c];
				u && (i || (i = !0, r.push("\n                        var tS = r.texture;\n                        ")), t._gl.uniform1i(u.location, a), n.push(`
                        tS.bind(resources[${l}], ${a});
                    `), a++);
			}
		}
	}
	let s = [...r, ...n].join("\n");
	return Function("r", "s", "sD", s);
}
var Th = o((() => {
	gp(), ko(), ln();
})), Eh, Dh = o((() => {
	Eh = class {
		constructor(e, t) {
			this.program = e, this.uniformData = t, this.uniformGroups = {}, this.uniformDirtyGroups = {}, this.uniformBlockBindings = {};
		}
		destroy() {
			this.uniformData = null, this.uniformGroups = null, this.uniformDirtyGroups = null, this.uniformBlockBindings = null, this.program = null;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/compileShader.mjs
function Oh(e, t, n) {
	let r = e.createShader(t);
	return e.shaderSource(r, n), e.compileShader(r), r;
}
var kh = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/defaultValue.mjs
function Ah(e) {
	let t = Array(e);
	for (let e = 0; e < t.length; e++) t[e] = !1;
	return t;
}
function jh(e, t) {
	switch (e) {
		case "float": return 0;
		case "vec2": return new Float32Array(2 * t);
		case "vec3": return new Float32Array(3 * t);
		case "vec4": return new Float32Array(4 * t);
		case "int":
		case "uint":
		case "sampler2D":
		case "sampler2DArray": return 0;
		case "ivec2": return new Int32Array(2 * t);
		case "ivec3": return new Int32Array(3 * t);
		case "ivec4": return new Int32Array(4 * t);
		case "uvec2": return new Uint32Array(2 * t);
		case "uvec3": return new Uint32Array(3 * t);
		case "uvec4": return new Uint32Array(4 * t);
		case "bool": return !1;
		case "bvec2": return Ah(2 * t);
		case "bvec3": return Ah(3 * t);
		case "bvec4": return Ah(4 * t);
		case "mat2": return new Float32Array([
			1,
			0,
			0,
			1
		]);
		case "mat3": return new Float32Array([
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		]);
		case "mat4": return new Float32Array([
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		]);
	}
	return null;
}
var Mh = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/mapType.mjs
function Nh(e, t) {
	if (!Fh) {
		let t = Object.keys(Ih);
		Fh = {};
		for (let n = 0; n < t.length; ++n) {
			let r = t[n];
			Fh[e[r]] = Ih[r];
		}
	}
	return Fh[t];
}
function Ph(e, t) {
	return Lh[Nh(e, t)] || "float32";
}
var Fh, Ih, Lh, Rh = o((() => {
	Fh = null, Ih = {
		FLOAT: "float",
		FLOAT_VEC2: "vec2",
		FLOAT_VEC3: "vec3",
		FLOAT_VEC4: "vec4",
		INT: "int",
		INT_VEC2: "ivec2",
		INT_VEC3: "ivec3",
		INT_VEC4: "ivec4",
		UNSIGNED_INT: "uint",
		UNSIGNED_INT_VEC2: "uvec2",
		UNSIGNED_INT_VEC3: "uvec3",
		UNSIGNED_INT_VEC4: "uvec4",
		BOOL: "bool",
		BOOL_VEC2: "bvec2",
		BOOL_VEC3: "bvec3",
		BOOL_VEC4: "bvec4",
		FLOAT_MAT2: "mat2",
		FLOAT_MAT3: "mat3",
		FLOAT_MAT4: "mat4",
		SAMPLER_2D: "sampler2D",
		INT_SAMPLER_2D: "sampler2D",
		UNSIGNED_INT_SAMPLER_2D: "sampler2D",
		SAMPLER_CUBE: "samplerCube",
		INT_SAMPLER_CUBE: "samplerCube",
		UNSIGNED_INT_SAMPLER_CUBE: "samplerCube",
		SAMPLER_2D_ARRAY: "sampler2DArray",
		INT_SAMPLER_2D_ARRAY: "sampler2DArray",
		UNSIGNED_INT_SAMPLER_2D_ARRAY: "sampler2DArray"
	}, Lh = {
		float: "float32",
		vec2: "float32x2",
		vec3: "float32x3",
		vec4: "float32x4",
		int: "sint32",
		ivec2: "sint32x2",
		ivec3: "sint32x3",
		ivec4: "sint32x4",
		uint: "uint32",
		uvec2: "uint32x2",
		uvec3: "uint32x3",
		uvec4: "uint32x4",
		bool: "uint32",
		bvec2: "uint32x2",
		bvec3: "uint32x3",
		bvec4: "uint32x4"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/extractAttributesFromGlProgram.mjs
function zh(e, t, n = !1) {
	let r = {}, i = t.getProgramParameter(e, t.ACTIVE_ATTRIBUTES);
	for (let n = 0; n < i; n++) {
		let i = t.getActiveAttrib(e, n);
		if (i.name.startsWith("gl_")) continue;
		let a = Ph(t, i.type);
		r[i.name] = {
			location: 0,
			format: a,
			stride: Ya(a).stride,
			offset: 0,
			instance: !1,
			start: 0
		};
	}
	let a = Object.keys(r);
	if (n) {
		a.sort((e, t) => e > t ? 1 : -1);
		for (let n = 0; n < a.length; n++) r[a[n]].location = n, t.bindAttribLocation(e, n, a[n]);
		t.linkProgram(e);
	} else for (let n = 0; n < a.length; n++) r[a[n]].location = t.getAttribLocation(e, a[n]);
	return r;
}
var Bh = o((() => {
	Za(), Rh();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getUboData.mjs
function Vh(e, t) {
	if (!t.ACTIVE_UNIFORM_BLOCKS) return {};
	let n = {}, r = t.getProgramParameter(e, t.ACTIVE_UNIFORM_BLOCKS);
	for (let i = 0; i < r; i++) {
		let r = t.getActiveUniformBlockName(e, i);
		n[r] = {
			name: r,
			index: t.getUniformBlockIndex(e, r),
			size: t.getActiveUniformBlockParameter(e, i, t.UNIFORM_BLOCK_DATA_SIZE)
		};
	}
	return n;
}
var Hh = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getUniformData.mjs
function Uh(e, t) {
	let n = {}, r = t.getProgramParameter(e, t.ACTIVE_UNIFORMS);
	for (let i = 0; i < r; i++) {
		let r = t.getActiveUniform(e, i), a = r.name.replace(/\[.*?\]$/, ""), o = !!r.name.match(/\[.*?\]$/), s = Nh(t, r.type);
		n[a] = {
			name: a,
			index: i,
			type: s,
			size: r.size,
			isArray: o,
			value: jh(s, r.size)
		};
	}
	return n;
}
var Wh = o((() => {
	Mh(), Rh();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/logProgramError.mjs
function Gh(e, t) {
	let n = e.getShaderSource(t).split("\n").map((e, t) => `${t}: ${e}`), r = e.getShaderInfoLog(t), i = r.split("\n"), a = {}, o = i.map((e) => parseFloat(e.replace(/^ERROR\: 0\:([\d]+)\:.*$/, "$1"))).filter((e) => e && !a[e] ? (a[e] = !0, !0) : !1), s = [""];
	o.forEach((e) => {
		n[e - 1] = `%c${n[e - 1]}%c`, s.push("background: #FF0000; color:#FFFFFF; font-size: 10px", "font-size: 10px");
	}), s[0] = n.join("\n"), console.error(r), console.groupCollapsed("click to view full shader code"), console.warn(...s), console.groupEnd();
}
function Kh(e, t, n, r) {
	e.getProgramParameter(t, e.LINK_STATUS) || (e.getShaderParameter(n, e.COMPILE_STATUS) || Gh(e, n), e.getShaderParameter(r, e.COMPILE_STATUS) || Gh(e, r), console.error("PixiJS Error: Could not initialize shader."), e.getProgramInfoLog(t) !== "" && console.warn("PixiJS Warning: gl.getProgramInfoLog()", e.getProgramInfoLog(t)));
}
var qh = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/generateProgram.mjs
function Jh(e, t) {
	let n = Oh(e, e.VERTEX_SHADER, t.vertex), r = Oh(e, e.FRAGMENT_SHADER, t.fragment), i = e.createProgram();
	e.attachShader(i, n), e.attachShader(i, r);
	let a = t.transformFeedbackVaryings;
	a && (typeof e.transformFeedbackVaryings == "function" ? e.transformFeedbackVaryings(i, a.names, a.bufferMode === "separate" ? e.SEPARATE_ATTRIBS : e.INTERLEAVED_ATTRIBS) : H("TransformFeedback is not supported but TransformFeedbackVaryings are given.")), e.linkProgram(i), e.getProgramParameter(i, e.LINK_STATUS) || Kh(e, i, n, r), t._attributeData = zh(i, e, !/^[ \t]*#[ \t]*version[ \t]+300[ \t]+es[ \t]*$/m.test(t.vertex)), t._uniformData = Uh(i, e), t._uniformBlockData = Vh(i, e), e.deleteShader(n), e.deleteShader(r);
	let o = {};
	for (let n in t._uniformData) {
		let r = t._uniformData[n];
		o[n] = {
			location: e.getUniformLocation(i, n),
			value: jh(r.type, r.size)
		};
	}
	return new Eh(i, o);
}
var Yh = o((() => {
	U(), Dh(), kh(), Mh(), Bh(), Hh(), Wh(), qh();
})), Xh, Zh, Qh = o((() => {
	g(), Th(), Yh(), Xh = {
		textureCount: 0,
		blockIndex: 0
	}, Zh = class {
		constructor(e) {
			this._activeProgram = null, this._programDataHash = /* @__PURE__ */ Object.create(null), this._shaderSyncFunctions = /* @__PURE__ */ Object.create(null), this._renderer = e;
		}
		contextChange(e) {
			this._gl = e, this._programDataHash = /* @__PURE__ */ Object.create(null), this._shaderSyncFunctions = /* @__PURE__ */ Object.create(null), this._activeProgram = null;
		}
		bind(e, t) {
			if (this._setProgram(e.glProgram), t) return;
			Xh.textureCount = 0, Xh.blockIndex = 0;
			let n = this._shaderSyncFunctions[e.glProgram._key];
			n || (n = this._shaderSyncFunctions[e.glProgram._key] = this._generateShaderSync(e, this)), this._renderer.buffer.nextBindBase(!!e.glProgram.transformFeedbackVaryings), n(this._renderer, e, Xh);
		}
		updateUniformGroup(e) {
			this._renderer.uniformGroup.updateUniformGroup(e, this._activeProgram, Xh);
		}
		bindUniformBlock(e, t, n = 0) {
			let r = this._renderer.buffer, i = this._getProgramData(this._activeProgram), a = e._bufferResource;
			a || this._renderer.ubo.updateUniformGroup(e);
			let o = e.buffer, s = r.updateBuffer(o), c = r.freeLocationForBufferBase(s);
			if (a) {
				let { offset: t, size: n } = e;
				t === 0 && n === o.data.byteLength ? r.bindBufferBase(s, c) : r.bindBufferRange(s, c, t);
			} else r.getLastBindBaseLocation(s) !== c && r.bindBufferBase(s, c);
			let l = this._activeProgram._uniformBlockData[t].index;
			i.uniformBlockBindings[n] !== c && (i.uniformBlockBindings[n] = c, this._renderer.gl.uniformBlockBinding(i.program, l, c));
		}
		_setProgram(e) {
			if (this._activeProgram === e) return;
			this._activeProgram = e;
			let t = this._getProgramData(e);
			this._gl.useProgram(t.program);
		}
		_getProgramData(e) {
			return this._programDataHash[e._key] || this._createProgramData(e);
		}
		_createProgramData(e) {
			let t = e._key;
			return this._programDataHash[t] = Jh(this._gl, e), this._programDataHash[t];
		}
		destroy() {
			for (let e of Object.keys(this._programDataHash)) this._programDataHash[e].destroy();
			this._programDataHash = null, this._shaderSyncFunctions = null, this._activeProgram = null, this._renderer = null, this._gl = null;
		}
		_generateShaderSync(e, t) {
			return wh(e, t);
		}
		resetState() {
			this._activeProgram = null;
		}
	}, Zh.extension = {
		type: [f.WebGLSystem],
		name: "shader"
	};
})), $h, eg, tg = o((() => {
	$h = {
		f32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1f(location, v);\n        }",
		"vec2<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2f(location, v[0], v[1]);\n        }",
		"vec3<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3f(location, v[0], v[1], v[2]);\n        }",
		"vec4<f32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4f(location, v[0], v[1], v[2], v[3]);\n        }",
		i32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1i(location, v);\n        }",
		"vec2<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2i(location, v[0], v[1]);\n        }",
		"vec3<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3i(location, v[0], v[1], v[2]);\n        }",
		"vec4<i32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4i(location, v[0], v[1], v[2], v[3]);\n        }",
		u32: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1ui(location, v);\n        }",
		"vec2<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2ui(location, v[0], v[1]);\n        }",
		"vec3<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3ui(location, v[0], v[1], v[2]);\n        }",
		"vec4<u32>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4ui(location, v[0], v[1], v[2], v[3]);\n        }",
		bool: "if (cv !== v) {\n            cu.value = v;\n            gl.uniform1i(location, v);\n        }",
		"vec2<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            gl.uniform2i(location, v[0], v[1]);\n        }",
		"vec3<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            gl.uniform3i(location, v[0], v[1], v[2]);\n        }",
		"vec4<bool>": "if (cv[0] !== v[0] || cv[1] !== v[1] || cv[2] !== v[2] || cv[3] !== v[3]) {\n            cv[0] = v[0];\n            cv[1] = v[1];\n            cv[2] = v[2];\n            cv[3] = v[3];\n            gl.uniform4i(location, v[0], v[1], v[2], v[3]);\n        }",
		"mat2x2<f32>": "gl.uniformMatrix2fv(location, false, v);",
		"mat3x3<f32>": "gl.uniformMatrix3fv(location, false, v);",
		"mat4x4<f32>": "gl.uniformMatrix4fv(location, false, v);"
	}, eg = {
		f32: "gl.uniform1fv(location, v);",
		"vec2<f32>": "gl.uniform2fv(location, v);",
		"vec3<f32>": "gl.uniform3fv(location, v);",
		"vec4<f32>": "gl.uniform4fv(location, v);",
		"mat2x2<f32>": "gl.uniformMatrix2fv(location, false, v);",
		"mat3x3<f32>": "gl.uniformMatrix3fv(location, false, v);",
		"mat4x4<f32>": "gl.uniformMatrix4fv(location, false, v);",
		i32: "gl.uniform1iv(location, v);",
		"vec2<i32>": "gl.uniform2iv(location, v);",
		"vec3<i32>": "gl.uniform3iv(location, v);",
		"vec4<i32>": "gl.uniform4iv(location, v);",
		u32: "gl.uniform1iv(location, v);",
		"vec2<u32>": "gl.uniform2iv(location, v);",
		"vec3<u32>": "gl.uniform3iv(location, v);",
		"vec4<u32>": "gl.uniform4iv(location, v);",
		bool: "gl.uniform1iv(location, v);",
		"vec2<bool>": "gl.uniform2iv(location, v);",
		"vec3<bool>": "gl.uniform3iv(location, v);",
		"vec4<bool>": "gl.uniform4iv(location, v);"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/shader/utils/generateUniformsSync.mjs
function ng(e, t) {
	let n = ["\n        var v = null;\n        var cv = null;\n        var cu = null;\n        var t = 0;\n        var gl = renderer.gl;\n        var name = null;\n    "];
	for (let r in e.uniforms) {
		if (!t[r]) {
			e.uniforms[r] instanceof Oo ? e.uniforms[r].ubo ? n.push(`
                        renderer.shader.bindUniformBlock(uv.${r}, "${r}");
                    `) : n.push(`
                        renderer.shader.updateUniformGroup(uv.${r});
                    `) : e.uniforms[r] instanceof hp && n.push(`
                        renderer.shader.bindBufferResource(uv.${r}, "${r}");
                    `);
			continue;
		}
		let i = e.uniformStructures[r], a = !1;
		for (let e = 0; e < tp.length; e++) {
			let t = tp[e];
			if (i.type === t.type && t.test(i)) {
				n.push(`name = "${r}";`, tp[e].uniform), a = !0;
				break;
			}
		}
		if (!a) {
			let e = (i.size === 1 ? $h : eg)[i.type].replace("location", `ud["${r}"].location`);
			n.push(`
            cu = ud["${r}"];
            cv = cu.value;
            v = uv["${r}"];
            ${e};`);
		}
	}
	return Function("ud", "uv", "renderer", "syncData", n.join("\n"));
}
var rg = o((() => {
	gp(), ko(), np(), tg();
})), ig, ag = o((() => {
	g(), rg(), ig = class {
		constructor(e) {
			this._cache = {}, this._uniformGroupSyncHash = {}, this._renderer = e, this.gl = null, this._cache = {};
		}
		contextChange(e) {
			this.gl = e;
		}
		updateUniformGroup(e, t, n) {
			let r = this._renderer.shader._getProgramData(t);
			(!e.isStatic || e._dirtyId !== r.uniformDirtyGroups[e.uid]) && (r.uniformDirtyGroups[e.uid] = e._dirtyId, this._getUniformSyncFunction(e, t)(r.uniformData, e.uniforms, this._renderer, n));
		}
		_getUniformSyncFunction(e, t) {
			return this._uniformGroupSyncHash[e._signature]?.[t._key] || this._createUniformSyncFunction(e, t);
		}
		_createUniformSyncFunction(e, t) {
			let n = this._uniformGroupSyncHash[e._signature] || (this._uniformGroupSyncHash[e._signature] = {}), r = this._getSignature(e, t._uniformData, "u");
			return this._cache[r] || (this._cache[r] = this._generateUniformsSync(e, t._uniformData)), n[t._key] = this._cache[r], n[t._key];
		}
		_generateUniformsSync(e, t) {
			return ng(e, t);
		}
		_getSignature(e, t, n) {
			let r = e.uniforms, i = [`${n}-`];
			for (let e in r) i.push(e), t[e] && i.push(t[e].type);
			return i.join("-");
		}
		destroy() {
			this._renderer = null, this._cache = null;
		}
	}, ig.extension = {
		type: [f.WebGLSystem],
		name: "uniformGroup"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/state/mapWebGLBlendModesToPixi.mjs
function og(e) {
	let t = {};
	if (t.normal = [e.ONE, e.ONE_MINUS_SRC_ALPHA], t.add = [e.ONE, e.ONE], t.multiply = [
		e.DST_COLOR,
		e.ONE_MINUS_SRC_ALPHA,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.screen = [
		e.ONE,
		e.ONE_MINUS_SRC_COLOR,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.none = [0, 0], t["normal-npm"] = [
		e.SRC_ALPHA,
		e.ONE_MINUS_SRC_ALPHA,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t["add-npm"] = [
		e.SRC_ALPHA,
		e.ONE,
		e.ONE,
		e.ONE
	], t["screen-npm"] = [
		e.SRC_ALPHA,
		e.ONE_MINUS_SRC_COLOR,
		e.ONE,
		e.ONE_MINUS_SRC_ALPHA
	], t.erase = [e.ZERO, e.ONE_MINUS_SRC_ALPHA], !(e instanceof J.get().getWebGLRenderingContext())) t.min = [
		e.ONE,
		e.ONE,
		e.ONE,
		e.ONE,
		e.MIN,
		e.MIN
	], t.max = [
		e.ONE,
		e.ONE,
		e.ONE,
		e.ONE,
		e.MAX,
		e.MAX
	];
	else {
		let n = e.getExtension("EXT_blend_minmax");
		n && (t.min = [
			e.ONE,
			e.ONE,
			e.ONE,
			e.ONE,
			n.MIN_EXT,
			n.MIN_EXT
		], t.max = [
			e.ONE,
			e.ONE,
			e.ONE,
			e.ONE,
			n.MAX_EXT,
			n.MAX_EXT
		]);
	}
	return t;
}
var sg = o((() => {
	Y();
})), cg, lg, ug, dg, fg, pg, mg, hg, gg = o((() => {
	g(), Vo(), sg(), cg = 0, lg = 1, ug = 2, dg = 3, fg = 4, pg = 5, mg = class e {
		constructor(e) {
			this._invertFrontFace = !1, this.gl = null, this.stateId = 0, this.polygonOffset = 0, this.blendMode = "none", this._blendEq = !1, this.map = [], this.map[cg] = this.setBlend, this.map[lg] = this.setOffset, this.map[ug] = this.setCullFace, this.map[dg] = this.setDepthTest, this.map[fg] = this.setFrontFace, this.map[pg] = this.setDepthMask, this.checks = [], this.defaultState = Bo.for2d(), e.renderTarget.onRenderTargetChange.add(this);
		}
		onRenderTargetChange(e) {
			this._invertFrontFace = !e.isRoot, this._cullFace ? this.setFrontFace(this._frontFace) : this._frontFaceDirty = !0;
		}
		contextChange(e) {
			this.gl = e, this.blendModesMap = og(e), this.resetState();
		}
		set(e) {
			if (e || (e = this.defaultState), this.stateId !== e.data) {
				let t = this.stateId ^ e.data, n = 0;
				for (; t;) t & 1 && this.map[n].call(this, !!(e.data & 1 << n)), t >>= 1, n++;
				this.stateId = e.data;
			}
			for (let t = 0; t < this.checks.length; t++) this.checks[t](this, e);
		}
		forceState(e) {
			e || (e = this.defaultState);
			for (let t = 0; t < this.map.length; t++) this.map[t].call(this, !!(e.data & 1 << t));
			for (let t = 0; t < this.checks.length; t++) this.checks[t](this, e);
			this.stateId = e.data;
		}
		setBlend(t) {
			this._updateCheck(e._checkBlendMode, t), this.gl[t ? "enable" : "disable"](this.gl.BLEND);
		}
		setOffset(t) {
			this._updateCheck(e._checkPolygonOffset, t), this.gl[t ? "enable" : "disable"](this.gl.POLYGON_OFFSET_FILL);
		}
		setDepthTest(e) {
			this.gl[e ? "enable" : "disable"](this.gl.DEPTH_TEST);
		}
		setDepthMask(e) {
			this.gl.depthMask(e);
		}
		setCullFace(e) {
			this._cullFace = e, this.gl[e ? "enable" : "disable"](this.gl.CULL_FACE), this._cullFace && this._frontFaceDirty && this.setFrontFace(this._frontFace);
		}
		setFrontFace(e) {
			this._frontFace = e, this._frontFaceDirty = !1;
			let t = this._invertFrontFace ? !e : e;
			this._glFrontFace !== t && (this._glFrontFace = t, this.gl.frontFace(this.gl[t ? "CW" : "CCW"]));
		}
		setBlendMode(e) {
			if (this.blendModesMap[e] || (e = "normal"), e === this.blendMode) return;
			this.blendMode = e;
			let t = this.blendModesMap[e], n = this.gl;
			t.length === 2 ? n.blendFunc(t[0], t[1]) : n.blendFuncSeparate(t[0], t[1], t[2], t[3]), t.length === 6 ? (this._blendEq = !0, n.blendEquationSeparate(t[4], t[5])) : this._blendEq && (this._blendEq = !1, n.blendEquationSeparate(n.FUNC_ADD, n.FUNC_ADD));
		}
		setPolygonOffset(e, t) {
			this.gl.polygonOffset(e, t);
		}
		resetState() {
			this._glFrontFace = !1, this._frontFace = !1, this._cullFace = !1, this._frontFaceDirty = !1, this._invertFrontFace = !1, this.gl.frontFace(this.gl.CCW), this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, !1), this.forceState(this.defaultState), this._blendEq = !0, this.blendMode = "", this.setBlendMode("normal");
		}
		_updateCheck(e, t) {
			let n = this.checks.indexOf(e);
			t && n === -1 ? this.checks.push(e) : !t && n !== -1 && this.checks.splice(n, 1);
		}
		static _checkBlendMode(e, t) {
			e.setBlendMode(t.blendMode);
		}
		static _checkPolygonOffset(e, t) {
			e.setPolygonOffset(1, t.polygonOffset);
		}
		destroy() {
			this.gl = null, this.checks.length = 0;
		}
	}, mg.extension = {
		type: [f.WebGLSystem],
		name: "state"
	}, hg = mg;
})), _g, vg = o((() => {
	Um(), _g = class {
		constructor(e) {
			this.target = Hm.TEXTURE_2D, this._layerInitMask = 0, this.texture = e, this.width = -1, this.height = -1, this.type = Z.UNSIGNED_BYTE, this.internalFormat = Vm.RGBA, this.format = Vm.RGBA, this.samplerType = 0;
		}
		destroy() {}
	};
})), yg, bg = o((() => {
	yg = {
		id: "buffer",
		upload(e, t, n, r, i, a = !1) {
			let o = i || t.target;
			!a && t.width === e.width && t.height === e.height ? n.texSubImage2D(o, 0, 0, 0, e.width, e.height, t.format, t.type, e.resource) : n.texImage2D(o, 0, t.internalFormat, e.width, e.height, 0, t.format, t.type, e.resource), t.width = e.width, t.height = e.height;
		}
	};
})), xg, Sg, Cg = o((() => {
	xg = {
		"bc1-rgba-unorm": !0,
		"bc1-rgba-unorm-srgb": !0,
		"bc2-rgba-unorm": !0,
		"bc2-rgba-unorm-srgb": !0,
		"bc3-rgba-unorm": !0,
		"bc3-rgba-unorm-srgb": !0,
		"bc4-r-unorm": !0,
		"bc4-r-snorm": !0,
		"bc5-rg-unorm": !0,
		"bc5-rg-snorm": !0,
		"bc6h-rgb-ufloat": !0,
		"bc6h-rgb-float": !0,
		"bc7-rgba-unorm": !0,
		"bc7-rgba-unorm-srgb": !0,
		"etc2-rgb8unorm": !0,
		"etc2-rgb8unorm-srgb": !0,
		"etc2-rgb8a1unorm": !0,
		"etc2-rgb8a1unorm-srgb": !0,
		"etc2-rgba8unorm": !0,
		"etc2-rgba8unorm-srgb": !0,
		"eac-r11unorm": !0,
		"eac-r11snorm": !0,
		"eac-rg11unorm": !0,
		"eac-rg11snorm": !0,
		"astc-4x4-unorm": !0,
		"astc-4x4-unorm-srgb": !0,
		"astc-5x4-unorm": !0,
		"astc-5x4-unorm-srgb": !0,
		"astc-5x5-unorm": !0,
		"astc-5x5-unorm-srgb": !0,
		"astc-6x5-unorm": !0,
		"astc-6x5-unorm-srgb": !0,
		"astc-6x6-unorm": !0,
		"astc-6x6-unorm-srgb": !0,
		"astc-8x5-unorm": !0,
		"astc-8x5-unorm-srgb": !0,
		"astc-8x6-unorm": !0,
		"astc-8x6-unorm-srgb": !0,
		"astc-8x8-unorm": !0,
		"astc-8x8-unorm-srgb": !0,
		"astc-10x5-unorm": !0,
		"astc-10x5-unorm-srgb": !0,
		"astc-10x6-unorm": !0,
		"astc-10x6-unorm-srgb": !0,
		"astc-10x8-unorm": !0,
		"astc-10x8-unorm-srgb": !0,
		"astc-10x10-unorm": !0,
		"astc-10x10-unorm-srgb": !0,
		"astc-12x10-unorm": !0,
		"astc-12x10-unorm-srgb": !0,
		"astc-12x12-unorm": !0,
		"astc-12x12-unorm-srgb": !0
	}, Sg = {
		id: "compressed",
		upload(e, t, n, r, i, a) {
			let o = i ?? t.target;
			n.pixelStorei(n.UNPACK_ALIGNMENT, 4);
			let s = e.pixelWidth, c = e.pixelHeight, l = !!xg[e.format];
			for (let r = 0; r < e.resource.length; r++) {
				let i = e.resource[r];
				l ? n.compressedTexImage2D(o, r, t.internalFormat, s, c, 0, i) : n.texImage2D(o, r, t.internalFormat, s, c, 0, t.format, t.type, i), s = Math.max(s >> 1, 1), c = Math.max(c >> 1, 1);
			}
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/uploaders/glUploadCubeTextureResource.mjs
function wg(e) {
	return {
		id: "cube",
		upload(t, n, r, i) {
			let a = t.faces;
			for (let t = 0; t < Tg.length; t++) {
				let o = a[Tg[t]];
				(e[o.uploadMethodId] || e.image).upload(o, n, r, i, Hm.TEXTURE_CUBE_MAP_POSITIVE_X + t, (n._layerInitMask & 1 << t) == 0), n._layerInitMask |= 1 << t;
			}
			n.width = t.pixelWidth, n.height = t.pixelHeight;
		}
	};
}
var Tg, Eg = o((() => {
	Um(), Tg = [
		"right",
		"left",
		"top",
		"bottom",
		"front",
		"back"
	];
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/uploaders/glUploadImageResource.mjs
function Dg(e, t, n, r, i, a, o, s, c, l) {
	if (!l) {
		c && e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, null), e.texSubImage2D(t, 0, 0, 0, a, o, n.format, n.type, s);
		return;
	}
	if (!c) {
		e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, s);
}
function Og(e, t, n, r, i, a, o, s, c, l) {
	if (!l) {
		c && e.texImage2D(t, 0, n.internalFormat, r, i, 0, n.format, n.type, null), e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	if (!c) {
		e.texSubImage2D(t, 0, 0, 0, n.format, n.type, s);
		return;
	}
	e.texImage2D(t, 0, n.internalFormat, n.format, n.type, s);
}
var kg, Ag = o((() => {
	kg = {
		id: "image",
		upload(e, t, n, r, i, a = !1) {
			let o = i || t.target, s = e.pixelWidth, c = e.pixelHeight, l = e.resourceWidth, u = e.resourceHeight, d = r === 2, f = a || t.width !== s || t.height !== c, p = l >= s && u >= c, m = e.resource;
			(d ? Dg : Og)(n, o, t, s, c, l, u, m, f, p), t.width = s, t.height = c;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/browser/isSafari.mjs
function jg() {
	let { userAgent: e } = J.get().getNavigator();
	return /^((?!chrome|android).)*safari/i.test(e);
}
var Mg = o((() => {
	Y();
})), Ng, Pg, Fg = o((() => {
	Mg(), Ag(), Ng = jg(), Pg = {
		id: "video",
		upload(e, t, n, r, i, a = Ng) {
			if (!e.isValid) {
				let e = i ?? t.target;
				n.texImage2D(e, 0, t.internalFormat, 1, 1, 0, t.format, t.type, null);
				return;
			}
			kg.upload(e, t, n, r, i, a);
		}
	};
})), Ig, Lg, Rg, zg, Bg = o((() => {
	Ig = {
		linear: 9729,
		nearest: 9728
	}, Lg = {
		linear: {
			linear: 9987,
			nearest: 9985
		},
		nearest: {
			linear: 9986,
			nearest: 9984
		}
	}, Rg = {
		"clamp-to-edge": 33071,
		repeat: 10497,
		"mirror-repeat": 33648
	}, zg = {
		never: 512,
		less: 513,
		equal: 514,
		"less-equal": 515,
		greater: 516,
		"not-equal": 517,
		"greater-equal": 518,
		always: 519
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/utils/applyStyleParams.mjs
function Vg(e, t, n, r, i, a, o, s) {
	let c = a;
	if (!s || e.addressModeU !== "repeat" || e.addressModeV !== "repeat" || e.addressModeW !== "repeat") {
		let n = Rg[o ? "clamp-to-edge" : e.addressModeU], r = Rg[o ? "clamp-to-edge" : e.addressModeV], a = Rg[o ? "clamp-to-edge" : e.addressModeW];
		t[i](c, t.TEXTURE_WRAP_S, n), t[i](c, t.TEXTURE_WRAP_T, r), t.TEXTURE_WRAP_R && t[i](c, t.TEXTURE_WRAP_R, a);
	}
	if ((!s || e.magFilter !== "linear") && t[i](c, t.TEXTURE_MAG_FILTER, Ig[e.magFilter]), n) {
		if (!s || e.mipmapFilter !== "linear") {
			let n = Lg[e.minFilter][e.mipmapFilter];
			t[i](c, t.TEXTURE_MIN_FILTER, n);
		}
	} else t[i](c, t.TEXTURE_MIN_FILTER, Ig[e.minFilter]);
	if (r && e.maxAnisotropy > 1) {
		let n = Math.min(e.maxAnisotropy, t.getParameter(r.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
		t[i](c, r.TEXTURE_MAX_ANISOTROPY_EXT, n);
	}
	e.compare && t[i](c, t.TEXTURE_COMPARE_FUNC, zg[e.compare]);
}
var Hg = o((() => {
	Bg();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/utils/mapFormatToGlFormat.mjs
function Ug(e) {
	return {
		r8unorm: e.RED,
		r8snorm: e.RED,
		r8uint: e.RED,
		r8sint: e.RED,
		r16uint: e.RED,
		r16sint: e.RED,
		r16float: e.RED,
		rg8unorm: e.RG,
		rg8snorm: e.RG,
		rg8uint: e.RG,
		rg8sint: e.RG,
		r32uint: e.RED,
		r32sint: e.RED,
		r32float: e.RED,
		rg16uint: e.RG,
		rg16sint: e.RG,
		rg16float: e.RG,
		rgba8unorm: e.RGBA,
		"rgba8unorm-srgb": e.RGBA,
		rgba8snorm: e.RGBA,
		rgba8uint: e.RGBA,
		rgba8sint: e.RGBA,
		bgra8unorm: e.RGBA,
		"bgra8unorm-srgb": e.RGBA,
		rgb9e5ufloat: e.RGB,
		rgb10a2unorm: e.RGBA,
		rg11b10ufloat: e.RGB,
		rg32uint: e.RG,
		rg32sint: e.RG,
		rg32float: e.RG,
		rgba16uint: e.RGBA,
		rgba16sint: e.RGBA,
		rgba16float: e.RGBA,
		rgba32uint: e.RGBA,
		rgba32sint: e.RGBA,
		rgba32float: e.RGBA,
		stencil8: e.STENCIL_INDEX8,
		depth16unorm: e.DEPTH_COMPONENT,
		depth24plus: e.DEPTH_COMPONENT,
		"depth24plus-stencil8": e.DEPTH_STENCIL,
		depth32float: e.DEPTH_COMPONENT,
		"depth32float-stencil8": e.DEPTH_STENCIL
	};
}
var Wg = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/utils/mapFormatToGlInternalFormat.mjs
function Gg(e, t) {
	let n = {}, r = e.RGBA;
	return e instanceof J.get().getWebGLRenderingContext() ? t.srgb && (n = {
		"rgba8unorm-srgb": t.srgb.SRGB8_ALPHA8_EXT,
		"bgra8unorm-srgb": t.srgb.SRGB8_ALPHA8_EXT
	}) : (n = {
		"rgba8unorm-srgb": e.SRGB8_ALPHA8,
		"bgra8unorm-srgb": e.SRGB8_ALPHA8
	}, r = e.RGBA8), {
		r8unorm: e.R8,
		r8snorm: e.R8_SNORM,
		r8uint: e.R8UI,
		r8sint: e.R8I,
		r16uint: e.R16UI,
		r16sint: e.R16I,
		r16float: e.R16F,
		rg8unorm: e.RG8,
		rg8snorm: e.RG8_SNORM,
		rg8uint: e.RG8UI,
		rg8sint: e.RG8I,
		r32uint: e.R32UI,
		r32sint: e.R32I,
		r32float: e.R32F,
		rg16uint: e.RG16UI,
		rg16sint: e.RG16I,
		rg16float: e.RG16F,
		rgba8unorm: e.RGBA,
		...n,
		rgba8snorm: e.RGBA8_SNORM,
		rgba8uint: e.RGBA8UI,
		rgba8sint: e.RGBA8I,
		bgra8unorm: r,
		rgb9e5ufloat: e.RGB9_E5,
		rgb10a2unorm: e.RGB10_A2,
		rg11b10ufloat: e.R11F_G11F_B10F,
		rg32uint: e.RG32UI,
		rg32sint: e.RG32I,
		rg32float: e.RG32F,
		rgba16uint: e.RGBA16UI,
		rgba16sint: e.RGBA16I,
		rgba16float: e.RGBA16F,
		rgba32uint: e.RGBA32UI,
		rgba32sint: e.RGBA32I,
		rgba32float: e.RGBA32F,
		stencil8: e.STENCIL_INDEX8,
		depth16unorm: e.DEPTH_COMPONENT16,
		depth24plus: e.DEPTH_COMPONENT24,
		"depth24plus-stencil8": e.DEPTH24_STENCIL8,
		depth32float: e.DEPTH_COMPONENT32F,
		"depth32float-stencil8": e.DEPTH32F_STENCIL8,
		...t.s3tc ? {
			"bc1-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT1_EXT,
			"bc2-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT3_EXT,
			"bc3-rgba-unorm": t.s3tc.COMPRESSED_RGBA_S3TC_DXT5_EXT
		} : {},
		...t.s3tc_sRGB ? {
			"bc1-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT,
			"bc2-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT,
			"bc3-rgba-unorm-srgb": t.s3tc_sRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT
		} : {},
		...t.rgtc ? {
			"bc4-r-unorm": t.rgtc.COMPRESSED_RED_RGTC1_EXT,
			"bc4-r-snorm": t.rgtc.COMPRESSED_SIGNED_RED_RGTC1_EXT,
			"bc5-rg-unorm": t.rgtc.COMPRESSED_RED_GREEN_RGTC2_EXT,
			"bc5-rg-snorm": t.rgtc.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT
		} : {},
		...t.bptc ? {
			"bc6h-rgb-float": t.bptc.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT,
			"bc6h-rgb-ufloat": t.bptc.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT,
			"bc7-rgba-unorm": t.bptc.COMPRESSED_RGBA_BPTC_UNORM_EXT,
			"bc7-rgba-unorm-srgb": t.bptc.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT
		} : {},
		...t.etc ? {
			"etc2-rgb8unorm": t.etc.COMPRESSED_RGB8_ETC2,
			"etc2-rgb8unorm-srgb": t.etc.COMPRESSED_SRGB8_ETC2,
			"etc2-rgb8a1unorm": t.etc.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2,
			"etc2-rgb8a1unorm-srgb": t.etc.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2,
			"etc2-rgba8unorm": t.etc.COMPRESSED_RGBA8_ETC2_EAC,
			"etc2-rgba8unorm-srgb": t.etc.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC,
			"eac-r11unorm": t.etc.COMPRESSED_R11_EAC,
			"eac-rg11unorm": t.etc.COMPRESSED_SIGNED_RG11_EAC
		} : {},
		...t.astc ? {
			"astc-4x4-unorm": t.astc.COMPRESSED_RGBA_ASTC_4x4_KHR,
			"astc-4x4-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR,
			"astc-5x4-unorm": t.astc.COMPRESSED_RGBA_ASTC_5x4_KHR,
			"astc-5x4-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR,
			"astc-5x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_5x5_KHR,
			"astc-5x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR,
			"astc-6x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_6x5_KHR,
			"astc-6x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR,
			"astc-6x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_6x6_KHR,
			"astc-6x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR,
			"astc-8x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x5_KHR,
			"astc-8x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR,
			"astc-8x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x6_KHR,
			"astc-8x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR,
			"astc-8x8-unorm": t.astc.COMPRESSED_RGBA_ASTC_8x8_KHR,
			"astc-8x8-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR,
			"astc-10x5-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x5_KHR,
			"astc-10x5-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR,
			"astc-10x6-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x6_KHR,
			"astc-10x6-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR,
			"astc-10x8-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x8_KHR,
			"astc-10x8-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR,
			"astc-10x10-unorm": t.astc.COMPRESSED_RGBA_ASTC_10x10_KHR,
			"astc-10x10-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR,
			"astc-12x10-unorm": t.astc.COMPRESSED_RGBA_ASTC_12x10_KHR,
			"astc-12x10-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR,
			"astc-12x12-unorm": t.astc.COMPRESSED_RGBA_ASTC_12x12_KHR,
			"astc-12x12-unorm-srgb": t.astc.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR
		} : {}
	};
}
var Kg = o((() => {
	Y();
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/utils/mapFormatToGlType.mjs
function qg(e) {
	return {
		r8unorm: e.UNSIGNED_BYTE,
		r8snorm: e.BYTE,
		r8uint: e.UNSIGNED_BYTE,
		r8sint: e.BYTE,
		r16uint: e.UNSIGNED_SHORT,
		r16sint: e.SHORT,
		r16float: e.HALF_FLOAT,
		rg8unorm: e.UNSIGNED_BYTE,
		rg8snorm: e.BYTE,
		rg8uint: e.UNSIGNED_BYTE,
		rg8sint: e.BYTE,
		r32uint: e.UNSIGNED_INT,
		r32sint: e.INT,
		r32float: e.FLOAT,
		rg16uint: e.UNSIGNED_SHORT,
		rg16sint: e.SHORT,
		rg16float: e.HALF_FLOAT,
		rgba8unorm: e.UNSIGNED_BYTE,
		"rgba8unorm-srgb": e.UNSIGNED_BYTE,
		rgba8snorm: e.BYTE,
		rgba8uint: e.UNSIGNED_BYTE,
		rgba8sint: e.BYTE,
		bgra8unorm: e.UNSIGNED_BYTE,
		"bgra8unorm-srgb": e.UNSIGNED_BYTE,
		rgb9e5ufloat: e.UNSIGNED_INT_5_9_9_9_REV,
		rgb10a2unorm: e.UNSIGNED_INT_2_10_10_10_REV,
		rg11b10ufloat: e.UNSIGNED_INT_10F_11F_11F_REV,
		rg32uint: e.UNSIGNED_INT,
		rg32sint: e.INT,
		rg32float: e.FLOAT,
		rgba16uint: e.UNSIGNED_SHORT,
		rgba16sint: e.SHORT,
		rgba16float: e.HALF_FLOAT,
		rgba32uint: e.UNSIGNED_INT,
		rgba32sint: e.INT,
		rgba32float: e.FLOAT,
		stencil8: e.UNSIGNED_BYTE,
		depth16unorm: e.UNSIGNED_SHORT,
		depth24plus: e.UNSIGNED_INT,
		"depth24plus-stencil8": e.UNSIGNED_INT_24_8,
		depth32float: e.FLOAT,
		"depth32float-stencil8": e.FLOAT_32_UNSIGNED_INT_24_8_REV
	};
}
var Jg = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/gl/texture/utils/mapViewDimensionToGlTarget.mjs
function Yg(e) {
	return {
		"2d": e.TEXTURE_2D,
		cube: e.TEXTURE_CUBE_MAP,
		"1d": null,
		"3d": e?.TEXTURE_3D || null,
		"2d-array": e?.TEXTURE_2D_ARRAY || null,
		"cube-array": e?.TEXTURE_CUBE_MAP_ARRAY || null
	};
}
var Xg = o((() => {})), Zg, Qg, $g = o((() => {
	Y(), g(), If(), q(), vg(), bg(), Cg(), Eg(), Ag(), Fg(), Hg(), Wg(), Kg(), Jg(), Xg(), Zg = 4, Qg = class {
		constructor(e) {
			this._glSamplers = /* @__PURE__ */ Object.create(null), this._boundTextures = [], this._activeTextureLocation = -1, this._boundSamplers = /* @__PURE__ */ Object.create(null), this._premultiplyAlpha = !1, this._useSeparateSamplers = !1, this._renderer = e, this._managedTextures = new Ff({
				renderer: e,
				type: "resource",
				onUnload: this.onSourceUnload.bind(this),
				name: "glTexture"
			});
			let t = {
				image: kg,
				buffer: yg,
				video: Pg,
				compressed: Sg
			};
			this._uploads = {
				...t,
				cube: wg(t)
			};
		}
		get managedTextures() {
			return Object.values(this._managedTextures.items);
		}
		contextChange(e) {
			this._gl = e, this._mapFormatToInternalFormat || (this._mapFormatToInternalFormat = Gg(e, this._renderer.context.extensions), this._mapFormatToType = qg(e), this._mapFormatToFormat = Ug(e), this._mapViewDimensionToGlTarget = Yg(e)), this._managedTextures.removeAll(!0), this._glSamplers = /* @__PURE__ */ Object.create(null), this._boundSamplers = /* @__PURE__ */ Object.create(null), this._premultiplyAlpha = !1;
			for (let e = 0; e < 16; e++) this.bind(K.EMPTY, e);
		}
		initSource(e) {
			this.bind(e);
		}
		bind(e, t = 0) {
			let n = e.source;
			e ? (this.bindSource(n, t), this._useSeparateSamplers && this._bindSampler(n.style, t)) : (this.bindSource(null, t), this._useSeparateSamplers && this._bindSampler(null, t));
		}
		bindSource(e, t = 0) {
			let n = this._gl;
			if (e._gcLastUsed = this._renderer.gc.now, this._boundTextures[t] !== e) {
				this._boundTextures[t] = e, this._activateLocation(t), e || (e = K.EMPTY.source);
				let r = this.getGlSource(e);
				n.bindTexture(r.target, r.texture);
			}
		}
		_bindSampler(e, t = 0) {
			let n = this._gl;
			if (!e) {
				this._boundSamplers[t] = null, n.bindSampler(t, null);
				return;
			}
			let r = this._getGlSampler(e);
			this._boundSamplers[t] !== r && (this._boundSamplers[t] = r, n.bindSampler(t, r));
		}
		unbind(e) {
			let t = e.source, n = this._boundTextures, r = this._gl;
			for (let e = 0; e < n.length; e++) if (n[e] === t) {
				this._activateLocation(e);
				let i = this.getGlSource(t);
				r.bindTexture(i.target, null), n[e] = null;
			}
		}
		_activateLocation(e) {
			this._activeTextureLocation !== e && (this._activeTextureLocation = e, this._gl.activeTexture(this._gl.TEXTURE0 + e));
		}
		_initSource(e) {
			let t = this._gl, n = new _g(t.createTexture());
			if (n.type = this._mapFormatToType[e.format], n.internalFormat = this._mapFormatToInternalFormat[e.format], n.format = this._mapFormatToFormat[e.format], n.target = this._mapViewDimensionToGlTarget[e.viewDimension], n.target === null) throw Error(`Unsupported view dimension: ${e.viewDimension} with this webgl version: ${this._renderer.context.webGLVersion}`);
			if (e.uploadMethodId === "cube" && (n.target = t.TEXTURE_CUBE_MAP), e.autoGenerateMipmaps && (this._renderer.context.supports.nonPowOf2mipmaps || e.isPowerOfTwo)) {
				let t = Math.max(e.width, e.height);
				e.mipLevelCount = Math.floor(Math.log2(t)) + 1;
			}
			return e._gpuData[this._renderer.uid] = n, this._managedTextures.add(e) && (e.on("update", this.onSourceUpdate, this), e.on("resize", this.onSourceUpdate, this), e.on("styleChange", this.onStyleChange, this), e.on("updateMipmaps", this.onUpdateMipmaps, this)), this.onSourceUpdate(e), this.updateStyle(e, !1), n;
		}
		onStyleChange(e) {
			this.updateStyle(e, !1);
		}
		updateStyle(e, t) {
			let n = this._gl, r = this.getGlSource(e);
			n.bindTexture(r.target, r.texture), this._boundTextures[this._activeTextureLocation] = e, Vg(e.style, n, e.mipLevelCount > 1, this._renderer.context.extensions.anisotropicFiltering, "texParameteri", r.target, !this._renderer.context.supports.nonPowOf2wrapping && !e.isPowerOfTwo, t);
		}
		onSourceUnload(e, t = !1) {
			let n = e._gpuData[this._renderer.uid];
			n && (t || (this.unbind(e), this._gl.deleteTexture(n.texture)), e.off("update", this.onSourceUpdate, this), e.off("resize", this.onSourceUpdate, this), e.off("styleChange", this.onStyleChange, this), e.off("updateMipmaps", this.onUpdateMipmaps, this));
		}
		onSourceUpdate(e) {
			let t = this._gl, n = this.getGlSource(e);
			t.bindTexture(n.target, n.texture), this._boundTextures[this._activeTextureLocation] = e;
			let r = e.alphaMode === "premultiply-alpha-on-upload";
			if (this._premultiplyAlpha !== r && (this._premultiplyAlpha = r, t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL, r)), this._uploads[e.uploadMethodId]) this._uploads[e.uploadMethodId].upload(e, n, t, this._renderer.context.webGLVersion);
			else if (n.target === t.TEXTURE_2D) this._initEmptyTexture2D(n, e);
			else if (n.target === t.TEXTURE_2D_ARRAY) this._initEmptyTexture2DArray(n, e);
			else if (n.target === t.TEXTURE_CUBE_MAP) this._initEmptyTextureCube(n, e);
			else throw Error("[GlTextureSystem] Unsupported texture target for empty allocation.");
			this._applyMipRange(n, e), e.autoGenerateMipmaps && e.mipLevelCount > 1 && this.onUpdateMipmaps(e, !1);
		}
		onUpdateMipmaps(e, t = !0) {
			t && this.bindSource(e, 0);
			let n = this.getGlSource(e);
			this._gl.generateMipmap(n.target);
		}
		_initEmptyTexture2D(e, t) {
			let n = this._gl;
			n.texImage2D(n.TEXTURE_2D, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, 0, e.format, e.type, null);
			let r = Math.max(t.pixelWidth >> 1, 1), i = Math.max(t.pixelHeight >> 1, 1);
			for (let a = 1; a < t.mipLevelCount; a++) n.texImage2D(n.TEXTURE_2D, a, e.internalFormat, r, i, 0, e.format, e.type, null), r = Math.max(r >> 1, 1), i = Math.max(i >> 1, 1);
		}
		_initEmptyTexture2DArray(e, t) {
			if (this._renderer.context.webGLVersion !== 2) throw Error("[GlTextureSystem] TEXTURE_2D_ARRAY requires WebGL2.");
			let n = this._gl, r = Math.max(t.arrayLayerCount | 0, 1);
			n.texImage3D(n.TEXTURE_2D_ARRAY, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, r, 0, e.format, e.type, null);
			let i = Math.max(t.pixelWidth >> 1, 1), a = Math.max(t.pixelHeight >> 1, 1);
			for (let o = 1; o < t.mipLevelCount; o++) n.texImage3D(n.TEXTURE_2D_ARRAY, o, e.internalFormat, i, a, r, 0, e.format, e.type, null), i = Math.max(i >> 1, 1), a = Math.max(a >> 1, 1);
		}
		_initEmptyTextureCube(e, t) {
			let n = this._gl;
			for (let r = 0; r < 6; r++) n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X + r, 0, e.internalFormat, t.pixelWidth, t.pixelHeight, 0, e.format, e.type, null);
			let r = Math.max(t.pixelWidth >> 1, 1), i = Math.max(t.pixelHeight >> 1, 1);
			for (let a = 1; a < t.mipLevelCount; a++) {
				for (let t = 0; t < 6; t++) n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X + t, a, e.internalFormat, r, i, 0, e.format, e.type, null);
				r = Math.max(r >> 1, 1), i = Math.max(i >> 1, 1);
			}
		}
		_applyMipRange(e, t) {
			if (this._renderer.context.webGLVersion !== 2) return;
			let n = this._gl, r = Math.max((t.mipLevelCount | 0) - 1, 0);
			n.texParameteri(e.target, n.TEXTURE_BASE_LEVEL, 0), n.texParameteri(e.target, n.TEXTURE_MAX_LEVEL, r);
		}
		_initSampler(e) {
			let t = this._gl, n = this._gl.createSampler();
			return this._glSamplers[e._resourceId] = n, Vg(e, t, this._boundTextures[this._activeTextureLocation].mipLevelCount > 1, this._renderer.context.extensions.anisotropicFiltering, "samplerParameteri", n, !1, !0), this._glSamplers[e._resourceId];
		}
		_getGlSampler(e) {
			return this._glSamplers[e._resourceId] || this._initSampler(e);
		}
		getGlSource(e) {
			return e._gcLastUsed = this._renderer.gc.now, e._gpuData[this._renderer.uid] || this._initSource(e);
		}
		generateCanvas(e) {
			let { pixels: t, width: n, height: r } = this.getPixels(e), i = J.get().createCanvas();
			i.width = n, i.height = r;
			let a = i.getContext("2d");
			if (a) {
				let e = a.createImageData(n, r);
				e.data.set(t), a.putImageData(e, 0, 0);
			}
			return i;
		}
		getPixels(e) {
			let t = e.source.resolution, n = e.frame, r = Math.max(Math.round(n.width * t), 1), i = Math.max(Math.round(n.height * t), 1), a = new Uint8Array(Zg * r * i), o = this._renderer, s = o.renderTarget.getRenderTarget(e), c = o.renderTarget.getGpuRenderTarget(s), l = o.gl;
			return l.bindFramebuffer(l.FRAMEBUFFER, c.resolveTargetFramebuffer), l.readPixels(Math.round(n.x * t), Math.round(n.y * t), r, i, l.RGBA, l.UNSIGNED_BYTE, a), {
				pixels: new Uint8ClampedArray(a.buffer),
				width: r,
				height: i
			};
		}
		destroy() {
			this._managedTextures.destroy(), this._glSamplers = null, this._boundTextures = null, this._boundSamplers = null, this._mapFormatToInternalFormat = null, this._mapFormatToType = null, this._mapFormatToFormat = null, this._uploads = null, this._renderer = null;
		}
		resetState() {
			this._activeTextureLocation = -1, this._boundTextures.fill(K.EMPTY.source), this._boundSamplers = /* @__PURE__ */ Object.create(null);
			let e = this._gl;
			this._premultiplyAlpha = !1, e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this._premultiplyAlpha);
		}
	}, Qg.extension = {
		type: [f.WebGLSystem],
		name: "texture"
	};
})), e_ = /* @__PURE__ */ c({ WebGLRenderer: () => s_ }), t_, n_, r_, i_, a_, o_, s_, c_ = o((() => {
	g(), Dm(), km(), jm(), Nc(), Mf(), xo(), Lm(), Bm(), Xm(), eh(), nh(), ih(), oh(), ch(), _h(), Ch(), Qh(), ag(), gg(), $g(), t_ = [
		...Af,
		gh,
		$m,
		zm,
		ah,
		Im,
		Qg,
		Sh,
		Ym,
		ig,
		Zh,
		rh,
		hg,
		sh,
		th
	], n_ = [...jf], r_ = [
		Am,
		Om,
		Em
	], i_ = [], a_ = [], o_ = [], h.handleByNamedList(f.WebGLSystem, i_), h.handleByNamedList(f.WebGLPipes, a_), h.handleByNamedList(f.WebGLPipesAdaptor, o_), h.add(...t_, ...n_, ...r_), s_ = class extends Mc {
		constructor() {
			let e = {
				name: "webgl",
				type: bo.WEBGL,
				systems: i_,
				renderPipes: a_,
				renderPipeAdaptors: o_
			};
			super(e);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/canvas/utils/canUseNewCanvasBlendModes.mjs
function l_(e) {
	let t = J.get().createCanvas(6, 1), n = t.getContext("2d");
	return n.fillStyle = e, n.fillRect(0, 0, 6, 1), t;
}
function u_() {
	if (d_ !== void 0) return d_;
	try {
		let e = l_("#ff00ff"), t = l_("#ffff00"), n = J.get().createCanvas(6, 1).getContext("2d");
		n.globalCompositeOperation = "multiply", n.drawImage(e, 0, 0), n.drawImage(t, 2, 0);
		let r = n.getImageData(2, 0, 1, 1);
		if (!r) d_ = !1;
		else {
			let e = r.data;
			d_ = e[0] === 255 && e[1] === 0 && e[2] === 0;
		}
	} catch {
		d_ = !1;
	}
	return d_;
}
var d_, f_ = o((() => {
	Y();
})), Q, p_ = o((() => {
	ye(), Y(), vn(), f_(), Q = {
		canvas: null,
		convertTintToImage: !1,
		cacheStepsPerColorChannel: 8,
		canUseMultiply: u_(),
		tintMethod: null,
		_canvasSourceCache: /* @__PURE__ */ new WeakMap(),
		_unpremultipliedCache: /* @__PURE__ */ new WeakMap(),
		getCanvasSource: (e) => {
			let t = e.source, n = t?.resource;
			if (!n) return null;
			let r = t.alphaMode === "premultiplied-alpha", i = t.resourceWidth ?? t.pixelWidth, a = t.resourceHeight ?? t.pixelHeight, o = i !== t.pixelWidth || a !== t.pixelHeight;
			if (r) {
				if ((n instanceof HTMLCanvasElement || typeof OffscreenCanvas < "u" && n instanceof OffscreenCanvas) && !o) return n;
				let e = Q._unpremultipliedCache.get(t);
				if (e?.resourceId === t._resourceId) return e.canvas;
			}
			if (n instanceof Uint8Array || n instanceof Uint8ClampedArray || n instanceof Int8Array || n instanceof Uint16Array || n instanceof Int16Array || n instanceof Uint32Array || n instanceof Int32Array || n instanceof Float32Array || n instanceof ArrayBuffer) {
				let e = Q._canvasSourceCache.get(t);
				if (e?.resourceId === t._resourceId) return e.canvas;
				let r = J.get().createCanvas(t.pixelWidth, t.pixelHeight), i = r.getContext("2d"), a = i.createImageData(t.pixelWidth, t.pixelHeight), o = a.data, s = n instanceof ArrayBuffer ? new Uint8Array(n) : new Uint8Array(n.buffer, n.byteOffset, n.byteLength);
				if (t.format === "bgra8unorm") for (let e = 0; e < o.length && e + 3 < s.length; e += 4) o[e] = s[e + 2], o[e + 1] = s[e + 1], o[e + 2] = s[e], o[e + 3] = s[e + 3];
				else o.set(s.subarray(0, o.length));
				return i.putImageData(a, 0, 0), Q._canvasSourceCache.set(t, {
					canvas: r,
					resourceId: t._resourceId
				}), r;
			}
			if (r) {
				let e = J.get().createCanvas(t.pixelWidth, t.pixelHeight), r = e.getContext("2d", { willReadFrequently: !0 });
				e.width = t.pixelWidth, e.height = t.pixelHeight, r.drawImage(n, 0, 0);
				let i = r.getImageData(0, 0, e.width, e.height), a = i.data;
				for (let e = 0; e < a.length; e += 4) {
					let t = a[e + 3];
					if (t > 0) {
						let n = 255 / t;
						a[e] = Math.min(255, a[e] * n + .5), a[e + 1] = Math.min(255, a[e + 1] * n + .5), a[e + 2] = Math.min(255, a[e + 2] * n + .5);
					}
				}
				return r.putImageData(i, 0, 0), Q._unpremultipliedCache.set(t, {
					canvas: e,
					resourceId: t._resourceId
				}), e;
			}
			if (o) {
				let e = Q._canvasSourceCache.get(t);
				if (e?.resourceId === t._resourceId) return e.canvas;
				let r = J.get().createCanvas(t.pixelWidth, t.pixelHeight), i = r.getContext("2d");
				return r.width = t.pixelWidth, r.height = t.pixelHeight, i.drawImage(n, 0, 0), Q._canvasSourceCache.set(t, {
					canvas: r,
					resourceId: t._resourceId
				}), r;
			}
			return n;
		},
		getTintedCanvas: (e, t) => {
			let n = e.texture, r = F.shared.setValue(t).toHex(), i = n.tintCache || (n.tintCache = {}), a = i[r], o = n.source._resourceId;
			if (a?.tintId === o) return a;
			let s = a && "getContext" in a ? a : J.get().createCanvas();
			if (Q.tintMethod(n, t, s), s.tintId = o, Q.convertTintToImage && s.toDataURL !== void 0) {
				let e = J.get().createImage();
				e.src = s.toDataURL(), e.tintId = o, i[r] = e;
			} else i[r] = s;
			return i[r];
		},
		getTintedPattern: (e, t) => {
			let n = F.shared.setValue(t).toHex(), r = e.patternCache || (e.patternCache = {}), i = e.source._resourceId, a = r[n];
			return a?.tintId === i ? a : (Q.canvas || (Q.canvas = J.get().createCanvas()), Q.tintMethod(e, t, Q.canvas), a = Q.canvas.getContext("2d").createPattern(Q.canvas, "repeat"), a.tintId = i, r[n] = a, a);
		},
		applyPatternTransform: (e, t, n = !0) => {
			if (!t) return;
			let r = e;
			if (!r.setTransform) return;
			let i = globalThis.DOMMatrix;
			if (!i) return;
			let a = new i([
				t.a,
				t.b,
				t.c,
				t.d,
				t.tx,
				t.ty
			]);
			r.setTransform(n ? a.inverse() : a);
		},
		tintWithMultiply: (e, t, n) => {
			let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
			i.x *= a, i.y *= a, i.width *= a, i.height *= a;
			let s = G.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
			n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.fillStyle = F.shared.setValue(t).toHex(), r.fillRect(0, 0, c, l), r.globalCompositeOperation = "multiply";
			let u = Q.getCanvasSource(e);
			if (!u) {
				r.restore();
				return;
			}
			o && Q._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.globalCompositeOperation = "destination-atop", r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
		},
		tintWithOverlay: (e, t, n) => {
			let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
			i.x *= a, i.y *= a, i.width *= a, i.height *= a;
			let s = G.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
			n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.globalCompositeOperation = "copy", r.fillStyle = F.shared.setValue(t).toHex(), r.fillRect(0, 0, c, l), r.globalCompositeOperation = "destination-atop";
			let u = Q.getCanvasSource(e);
			if (!u) {
				r.restore();
				return;
			}
			o && Q._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
		},
		tintWithPerPixel: (e, t, n) => {
			let r = n.getContext("2d"), i = e.frame.clone(), a = e.source._resolution ?? e.source.resolution ?? 1, o = e.rotate;
			i.x *= a, i.y *= a, i.width *= a, i.height *= a;
			let s = G.isVertical(o), c = s ? i.height : i.width, l = s ? i.width : i.height;
			n.width = Math.ceil(c), n.height = Math.ceil(l), r.save(), r.globalCompositeOperation = "copy";
			let u = Q.getCanvasSource(e);
			if (!u) {
				r.restore();
				return;
			}
			o && Q._applyInverseRotation(r, o, i.width, i.height), r.drawImage(u, i.x, i.y, i.width, i.height, 0, 0, i.width, i.height), r.restore();
			let d = t >> 16 & 255, f = t >> 8 & 255, p = t & 255, m = r.getImageData(0, 0, c, l), h = m.data;
			for (let e = 0; e < h.length; e += 4) h[e] = h[e] * d / 255, h[e + 1] = h[e + 1] * f / 255, h[e + 2] = h[e + 2] * p / 255;
			r.putImageData(m, 0, 0);
		},
		_applyInverseRotation: (e, t, n, r) => {
			let i = G.inv(t), a = G.uX(i), o = G.uY(i), s = G.vX(i), c = G.vY(i), l = -Math.min(0, a * n, s * r, a * n + s * r), u = -Math.min(0, o * n, c * r, o * n + c * r);
			e.transform(a, o, s, c, l, u);
		}
	}, Q.tintMethod = Q.canUseMultiply ? Q.tintWithMultiply : Q.tintWithPerPixel;
})), m_, h_, g_ = o((() => {
	m_ = 1e-4, h_ = 1e-4;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/getOrientationOfPoints.mjs
function __(e) {
	let t = e.length;
	if (t < 6) return 1;
	let n = 0;
	for (let r = 0, i = e[t - 2], a = e[t - 1]; r < t; r += 2) {
		let t = e[r], o = e[r + 1];
		n += (t - i) * (o + a), i = t, a = o;
	}
	return n < 0 ? -1 : 1;
}
var v_ = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildLine.mjs
function y_(e, t, n, r, i, a, o, s) {
	let c = e - n * i, l = t - r * i, u = e + n * a, d = t + r * a, f, p;
	o ? (f = r, p = -n) : (f = -r, p = n);
	let m = c + f, h = l + p, g = u + f, _ = d + p;
	return s.push(m, h), s.push(g, _), 2;
}
function b_(e, t, n, r, i, a, o, s) {
	let c = n - e, l = r - t, u = Math.atan2(c, l), d = Math.atan2(i - e, a - t);
	s && u < d ? u += Math.PI * 2 : !s && u > d && (d += Math.PI * 2);
	let f = u, p = d - u, m = Math.abs(p), h = Math.sqrt(c * c + l * l), g = (15 * m * Math.sqrt(h) / Math.PI >> 0) + 1, _ = p / g;
	if (f += _, s) {
		o.push(e, t), o.push(n, r);
		for (let n = 1, r = f; n < g; n++, r += _) o.push(e, t), o.push(e + Math.sin(r) * h, t + Math.cos(r) * h);
		o.push(e, t), o.push(i, a);
	} else {
		o.push(n, r), o.push(e, t);
		for (let n = 1, r = f; n < g; n++, r += _) o.push(e + Math.sin(r) * h, t + Math.cos(r) * h), o.push(e, t);
		o.push(i, a), o.push(e, t);
	}
	return g * 2;
}
function x_(e, t, n, r, i, a) {
	let o = m_;
	if (e.length === 0) return;
	let s = t, c = s.alignment;
	if (t.alignment !== .5) {
		let t = __(e);
		n && (t *= -1), c = (c - .5) * t + .5;
	}
	let l = new I(e[0], e[1]), u = new I(e[e.length - 2], e[e.length - 1]), d = r, f = Math.abs(l.x - u.x) < o && Math.abs(l.y - u.y) < o;
	if (d) {
		e = e.slice(), f && (e.pop(), e.pop(), u.set(e[e.length - 2], e[e.length - 1]));
		let t = (l.x + u.x) * .5, n = (u.y + l.y) * .5;
		e.unshift(t, n), e.push(t, n);
	}
	let p = i, m = e.length / 2, h = e.length, g = p.length / 2, _ = s.width / 2, v = _ * _, y = s.miterLimit * s.miterLimit, b = e[0], x = e[1], S = e[2], C = e[3], w = 0, T = 0, E = -(x - C), D = b - S, O = 0, k = 0, A = Math.sqrt(E * E + D * D);
	E /= A, D /= A, E *= _, D *= _;
	let j = c, M = (1 - j) * 2, N = j * 2;
	d || (s.cap === "round" ? h += b_(b - E * (M - N) * .5, x - D * (M - N) * .5, b - E * M, x - D * M, b + E * N, x + D * N, p, !0) + 2 : s.cap === "square" && (h += y_(b, x, E, D, M, N, !0, p))), p.push(b - E * M, x - D * M), p.push(b + E * N, x + D * N);
	for (let t = 1; t < m - 1; ++t) {
		b = e[(t - 1) * 2], x = e[(t - 1) * 2 + 1], S = e[t * 2], C = e[t * 2 + 1], w = e[(t + 1) * 2], T = e[(t + 1) * 2 + 1], E = -(x - C), D = b - S, A = Math.sqrt(E * E + D * D), E /= A, D /= A, E *= _, D *= _, O = -(C - T), k = S - w, A = Math.sqrt(O * O + k * k), O /= A, k /= A, O *= _, k *= _;
		let n = S - b, r = x - C, i = S - w, a = T - C, o = n * i + r * a, c = r * i - a * n, l = c < 0;
		if (Math.abs(c) < .001 * Math.abs(o)) {
			p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), o >= 0 && (s.join === "round" ? h += b_(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 4 : h += 2, p.push(S - O * N, C - k * N), p.push(S + O * M, C + k * M));
			continue;
		}
		let u = (-E + b) * (-D + C) - (-E + S) * (-D + x), d = (-O + w) * (-k + C) - (-O + S) * (-k + T), f = (n * d - i * u) / c, m = (a * u - r * d) / c, g = (f - S) * (f - S) + (m - C) * (m - C), j = S + (f - S) * M, ee = C + (m - C) * M, te = S - (f - S) * N, ne = C - (m - C) * N, re = Math.min(n * n + r * r, i * i + a * a), ie = l ? M : N;
		g <= re + ie * ie * v ? s.join === "bevel" || g / v > y ? (l ? (p.push(j, ee), p.push(S + E * N, C + D * N), p.push(j, ee), p.push(S + O * N, C + k * N)) : (p.push(S - E * M, C - D * M), p.push(te, ne), p.push(S - O * M, C - k * M), p.push(te, ne)), h += 2) : s.join === "round" ? l ? (p.push(j, ee), p.push(S + E * N, C + D * N), h += b_(S, C, S + E * N, C + D * N, S + O * N, C + k * N, p, !0) + 4, p.push(j, ee), p.push(S + O * N, C + k * N)) : (p.push(S - E * M, C - D * M), p.push(te, ne), h += b_(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 4, p.push(S - O * M, C - k * M), p.push(te, ne)) : (p.push(j, ee), p.push(te, ne)) : (p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), s.join === "round" ? l ? h += b_(S, C, S + E * N, C + D * N, S + O * N, C + k * N, p, !0) + 2 : h += b_(S, C, S - E * M, C - D * M, S - O * M, C - k * M, p, !1) + 2 : s.join === "miter" && g / v <= y && (l ? (p.push(te, ne), p.push(te, ne)) : (p.push(j, ee), p.push(j, ee)), h += 2), p.push(S - O * M, C - k * M), p.push(S + O * N, C + k * N), h += 2);
	}
	b = e[(m - 2) * 2], x = e[(m - 2) * 2 + 1], S = e[(m - 1) * 2], C = e[(m - 1) * 2 + 1], E = -(x - C), D = b - S, A = Math.sqrt(E * E + D * D), E /= A, D /= A, E *= _, D *= _, p.push(S - E * M, C - D * M), p.push(S + E * N, C + D * N), d || (s.cap === "round" ? h += b_(S - E * (M - N) * .5, C - D * (M - N) * .5, S - E * M, C - D * M, S + E * N, C + D * N, p, !1) + 2 : s.cap === "square" && (h += y_(S, C, E, D, M, N, !1, p)));
	let ee = h_ * h_;
	for (let e = g; e < h + g - 2; ++e) b = p[e * 2], x = p[e * 2 + 1], S = p[(e + 1) * 2], C = p[(e + 1) * 2 + 1], w = p[(e + 2) * 2], T = p[(e + 2) * 2 + 1], !(Math.abs(b * (C - T) + S * (T - x) + w * (x - C)) < ee) && a.push(e, e + 1, e + 2);
}
var S_ = o((() => {
	De(), g_(), v_();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/fill/FillGradient.mjs
function C_(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		e.addColorStop(r.offset, r.color);
	}
}
function w_(e, t) {
	let n = J.get().createCanvas(e, t);
	return {
		canvas: n,
		context: n.getContext("2d")
	};
}
function T_(e) {
	let t = e[0] ?? {};
	return (typeof t == "number" || e[1]) && (V("8.5.2", "use options object instead"), t = {
		type: "linear",
		start: {
			x: e[0],
			y: e[1]
		},
		end: {
			x: e[2],
			y: e[3]
		},
		textureSpace: e[4],
		textureSize: e[5] ?? O_.defaultLinearOptions.textureSize
	}), t;
}
var E_, D_, O_, k_ = o((() => {
	ye(), Y(), R(), ia(), q(), Ne(), Le(), en(), E_ = [{
		offset: 0,
		color: "white"
	}, {
		offset: 1,
		color: "black"
	}], D_ = class e {
		constructor(...t) {
			this.uid = z("fillGradient"), this._tick = 0, this.type = "linear", this.colorStops = [];
			let n = T_(t);
			n = {
				...n.type === "radial" ? e.defaultRadialOptions : e.defaultLinearOptions,
				...$t(n)
			}, this._textureSize = n.textureSize, this._wrapMode = n.wrapMode, n.type === "radial" ? (this.center = n.center, this.outerCenter = n.outerCenter ?? this.center, this.innerRadius = n.innerRadius, this.outerRadius = n.outerRadius, this.scale = n.scale, this.rotation = n.rotation) : (this.start = n.start, this.end = n.end), this.textureSpace = n.textureSpace, this.type = n.type, n.colorStops.forEach((e) => {
				this.addColorStop(e.offset, e.color);
			});
		}
		addColorStop(e, t) {
			return this.colorStops.push({
				offset: e,
				color: F.shared.setValue(t).toHexa()
			}), this;
		}
		buildLinearGradient() {
			if (this.texture) return;
			let { x: e, y: t } = this.start, { x: n, y: r } = this.end, i = n - e, a = r - t, o = i < 0 || a < 0;
			if (this._wrapMode === "clamp-to-edge") {
				if (i < 0) {
					let t = e;
					e = n, n = t, i *= -1;
				}
				if (a < 0) {
					let e = t;
					t = r, r = e, a *= -1;
				}
			}
			let s = this.colorStops.length ? this.colorStops : E_, c = this._textureSize, { canvas: l, context: u } = w_(c, 1), d = o ? u.createLinearGradient(this._textureSize, 0, 0, 0) : u.createLinearGradient(0, 0, this._textureSize, 0);
			C_(d, s), u.fillStyle = d, u.fillRect(0, 0, c, 1), this.texture = new K({ source: new ra({
				resource: l,
				addressMode: this._wrapMode
			}) });
			let f = Math.sqrt(i * i + a * a), p = Math.atan2(a, i), m = new L();
			m.scale(f / c, 1), m.rotate(p), m.translate(e, t), this.textureSpace === "local" && m.scale(c, c), this.transform = m;
		}
		buildGradient() {
			this.texture || this._tick++, this.type === "linear" ? this.buildLinearGradient() : this.buildRadialGradient();
		}
		buildRadialGradient() {
			if (this.texture) return;
			let e = this.colorStops.length ? this.colorStops : E_, t = this._textureSize, { canvas: n, context: r } = w_(t, t), { x: i, y: a } = this.center, { x: o, y: s } = this.outerCenter, c = this.innerRadius, l = this.outerRadius, u = o - l, d = s - l, f = t / (l * 2), p = (i - u) * f, m = (a - d) * f, h = r.createRadialGradient(p, m, c * f, (o - u) * f, (s - d) * f, l * f);
			C_(h, e), r.fillStyle = e[e.length - 1].color, r.fillRect(0, 0, t, t), r.fillStyle = h, r.translate(p, m), r.rotate(this.rotation), r.scale(1, this.scale), r.translate(-p, -m), r.fillRect(0, 0, t, t), this.texture = new K({ source: new ra({
				resource: n,
				addressMode: this._wrapMode
			}) });
			let g = new L();
			g.scale(1 / f, 1 / f), g.translate(u, d), this.textureSpace === "local" && g.scale(t, t), this.transform = g;
		}
		destroy() {
			this.texture?.destroy(!0), this.texture = null, this.transform = null, this.colorStops = [], this.start = null, this.end = null, this.center = null, this.outerCenter = null;
		}
		get styleKey() {
			return `fill-gradient-${this.uid}-${this._tick}`;
		}
	}, D_.defaultLinearOptions = {
		start: {
			x: 0,
			y: 0
		},
		end: {
			x: 0,
			y: 1
		},
		colorStops: [],
		textureSpace: "local",
		type: "linear",
		textureSize: 256,
		wrapMode: "clamp-to-edge"
	}, D_.defaultRadialOptions = {
		center: {
			x: .5,
			y: .5
		},
		innerRadius: 0,
		outerRadius: .5,
		colorStops: [],
		scale: 1,
		textureSpace: "local",
		type: "radial",
		textureSize: 256,
		wrapMode: "clamp-to-edge"
	}, O_ = D_;
})), A_, j_, M_ = o((() => {
	R(), Ne(), A_ = {
		repeat: {
			addressModeU: "repeat",
			addressModeV: "repeat"
		},
		"repeat-x": {
			addressModeU: "repeat",
			addressModeV: "clamp-to-edge"
		},
		"repeat-y": {
			addressModeU: "clamp-to-edge",
			addressModeV: "repeat"
		},
		"no-repeat": {
			addressModeU: "clamp-to-edge",
			addressModeV: "clamp-to-edge"
		}
	}, j_ = class {
		constructor(e, t) {
			this.uid = z("fillPattern"), this._tick = 0, this.transform = new L(), this.texture = e, this.transform.scale(1 / e.frame.width, 1 / e.frame.height), t && (e.source.style.addressModeU = A_[t].addressModeU, e.source.style.addressModeV = A_[t].addressModeV);
		}
		setTransform(e) {
			let t = this.texture;
			this.transform.copyFrom(e), this.transform.invert(), this.transform.scale(1 / t.frame.width, 1 / t.frame.height), this._tick++;
		}
		get texture() {
			return this._texture;
		}
		set texture(e) {
			this._texture !== e && (this._texture = e, this._tick++);
		}
		get styleKey() {
			return `fill-pattern-${this.uid}-${this._tick}`;
		}
		destroy() {
			this.texture.destroy(!0), this.texture = null;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/buildUvs.mjs
function N_(e, t, n, r, i, a, o, s = null) {
	let c = 0;
	n *= t, i *= a;
	let l = s.a, u = s.b, d = s.c, f = s.d, p = s.tx, m = s.ty;
	for (; c < o;) {
		let o = e[n], s = e[n + 1];
		r[i] = l * o + d * s + p, r[i + 1] = u * o + f * s + m, i += a, n += t, c++;
	}
}
function P_(e, t, n, r) {
	let i = 0;
	for (t *= n; i < r;) e[t] = 0, e[t + 1] = 0, t += n, i++;
}
var F_ = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/shared/geometry/utils/transformVertices.mjs
function I_(e, t, n, r, i) {
	let a = t.a, o = t.b, s = t.c, c = t.d, l = t.tx, u = t.ty;
	n || (n = 0), r || (r = 2), i || (i = e.length / r - n);
	let d = n * r;
	for (let t = 0; t < i; t++) {
		let t = e[d], n = e[d + 1];
		e[d] = a * t + s * n + l, e[d + 1] = o * t + c * n + u, d += r;
	}
}
var L_ = o((() => {})), R_, z_, B_ = o((() => {
	R(), Et(), R_ = new L(), z_ = class {
		constructor() {
			this.packAsQuad = !1, this.batcherName = "default", this.topology = "triangle-list", this.applyTransform = !0, this.roundPixels = 0, this._batcher = null, this._batch = null;
		}
		get uvs() {
			return this.geometryData.uvs;
		}
		get positions() {
			return this.geometryData.vertices;
		}
		get indices() {
			return this.geometryData.indices;
		}
		get blendMode() {
			return this.renderable && this.applyTransform ? this.renderable.groupBlendMode : "normal";
		}
		get color() {
			let e = this.baseColor, t = e >> 16 | e & 65280 | (e & 255) << 16, n = this.renderable;
			return n ? Tt(t, n.groupColor) + (this.alpha * n.groupAlpha * 255 << 24) : t + (this.alpha * 255 << 24);
		}
		get transform() {
			return this.renderable?.groupTransform || R_;
		}
		copyTo(e) {
			e.indexOffset = this.indexOffset, e.indexSize = this.indexSize, e.attributeOffset = this.attributeOffset, e.attributeSize = this.attributeSize, e.baseColor = this.baseColor, e.alpha = this.alpha, e.texture = this.texture, e.geometryData = this.geometryData, e.topology = this.topology;
		}
		reset() {
			this.applyTransform = !0, this.renderable = null, this.topology = "triangle-list";
		}
		destroy() {
			this.renderable = null, this.texture = null, this.geometryData = null, this._batcher = null, this._batch = null;
		}
	};
})), V_, H_, U_, W_ = o((() => {
	g(), V_ = {
		extension: {
			type: f.ShapeBuilder,
			name: "circle"
		},
		build(e, t) {
			let n, r, i, a, o, s;
			if (e.type === "circle") {
				let t = e;
				if (o = s = t.radius, o <= 0) return !1;
				n = t.x, r = t.y, i = a = 0;
			} else if (e.type === "ellipse") {
				let t = e;
				if (o = t.halfWidth, s = t.halfHeight, o <= 0 || s <= 0) return !1;
				n = t.x, r = t.y, i = a = 0;
			} else {
				let t = e, c = t.width / 2, l = t.height / 2;
				n = t.x + c, r = t.y + l, o = s = Math.max(0, Math.min(t.radius, Math.min(c, l))), i = c - o, a = l - s;
			}
			if (i < 0 || a < 0) return !1;
			let c = Math.ceil(2.3 * Math.sqrt(o + s)), l = c * 8 + (i ? 4 : 0) + (a ? 4 : 0);
			if (l === 0) return !1;
			if (c === 0) return t[0] = t[6] = n + i, t[1] = t[3] = r + a, t[2] = t[4] = n - i, t[5] = t[7] = r - a, !0;
			let u = 0, d = c * 4 + (i ? 2 : 0) + 2, f = d, p = l, m = i + o, h = a, g = n + m, _ = n - m, v = r + h;
			if (t[u++] = g, t[u++] = v, t[--d] = v, t[--d] = _, a) {
				let e = r - h;
				t[f++] = _, t[f++] = e, t[--p] = e, t[--p] = g;
			}
			for (let e = 1; e < c; e++) {
				let l = Math.PI / 2 * (e / c), m = i + Math.cos(l) * o, h = a + Math.sin(l) * s, g = n + m, _ = n - m, v = r + h, y = r - h;
				t[u++] = g, t[u++] = v, t[--d] = v, t[--d] = _, t[f++] = _, t[f++] = y, t[--p] = y, t[--p] = g;
			}
			m = i, h = a + s, g = n + m, _ = n - m, v = r + h;
			let y = r - h;
			return t[u++] = g, t[u++] = v, t[--p] = y, t[--p] = g, i && (t[u++] = _, t[u++] = v, t[--p] = y, t[--p] = _), !0;
		},
		triangulate(e, t, n, r, i, a) {
			if (e.length === 0) return;
			let o = 0, s = 0;
			for (let t = 0; t < e.length; t += 2) o += e[t], s += e[t + 1];
			o /= e.length / 2, s /= e.length / 2;
			let c = r;
			t[c * n] = o, t[c * n + 1] = s;
			let l = c++;
			for (let r = 0; r < e.length; r += 2) t[c * n] = e[r], t[c * n + 1] = e[r + 1], r > 0 && (i[a++] = c, i[a++] = l, i[a++] = c - 1), c++;
			i[a++] = l + 1, i[a++] = l, i[a++] = c - 1;
		}
	}, H_ = {
		...V_,
		extension: {
			...V_.extension,
			name: "ellipse"
		}
	}, U_ = {
		...V_,
		extension: {
			...V_.extension,
			name: "roundedRectangle"
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildPixelLine.mjs
function G_(e, t, n, r) {
	let i = m_;
	if (e.length === 0) return;
	let a = e[0], o = e[1], s = e[e.length - 2], c = e[e.length - 1], l = t || Math.abs(a - s) < i && Math.abs(o - c) < i, u = n, d = e.length / 2, f = u.length / 2;
	for (let t = 0; t < d; t++) u.push(e[t * 2]), u.push(e[t * 2 + 1]);
	for (let e = 0; e < d - 1; e++) r.push(f + e, f + e + 1);
	l && r.push(f + d - 1, f);
}
var K_ = o((() => {
	g_();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/triangulateWithHoles.mjs
function q_(e, t, n, r, i, a, o) {
	let s = wc(e, t, 2);
	if (!s) return;
	for (let e = 0; e < s.length; e += 3) a[o++] = s[e] + i, a[o++] = s[e + 1] + i, a[o++] = s[e + 2] + i;
	let c = i * r;
	for (let t = 0; t < e.length; t += 2) n[c] = e[t], n[c + 1] = e[t + 1], c += r;
}
var J_ = o((() => {
	Tc();
})), Y_, X_, Z_ = o((() => {
	g(), J_(), Y_ = [], X_ = {
		extension: {
			type: f.ShapeBuilder,
			name: "polygon"
		},
		build(e, t) {
			for (let n = 0; n < e.points.length; n++) t[n] = e.points[n];
			return !0;
		},
		triangulate(e, t, n, r, i, a) {
			q_(e, Y_, t, n, r, i, a);
		}
	};
})), Q_, $_ = o((() => {
	g(), Q_ = {
		extension: {
			type: f.ShapeBuilder,
			name: "rectangle"
		},
		build(e, t) {
			let n = e, r = n.x, i = n.y, a = n.width, o = n.height;
			return a > 0 && o > 0 ? (t[0] = r, t[1] = i, t[2] = r + a, t[3] = i, t[4] = r + a, t[5] = i + o, t[6] = r, t[7] = i + o, !0) : !1;
		},
		triangulate(e, t, n, r, i, a) {
			let o = 0;
			r *= n, t[r + o] = e[0], t[r + o + 1] = e[1], o += n, t[r + o] = e[2], t[r + o + 1] = e[3], o += n, t[r + o] = e[6], t[r + o + 1] = e[7], o += n, t[r + o] = e[4], t[r + o + 1] = e[5], o += n;
			let s = r / n;
			i[a++] = s, i[a++] = s + 1, i[a++] = s + 2, i[a++] = s + 1, i[a++] = s + 3, i[a++] = s + 2;
		}
	};
})), ev, tv = o((() => {
	g(), ev = {
		extension: {
			type: f.ShapeBuilder,
			name: "triangle"
		},
		build(e, t) {
			return t[0] = e.x, t[1] = e.y, t[2] = e.x2, t[3] = e.y2, t[4] = e.x3, t[5] = e.y3, !0;
		},
		triangulate(e, t, n, r, i, a) {
			let o = 0;
			r *= n, t[r + o] = e[0], t[r + o + 1] = e[1], o += n, t[r + o] = e[2], t[r + o + 1] = e[3], o += n, t[r + o] = e[4], t[r + o + 1] = e[5];
			let s = r / n;
			i[a++] = s, i[a++] = s + 1, i[a++] = s + 2;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/generateTextureFillMatrix.mjs
function nv(e, t, n, r) {
	let i = t.matrix ? e.copyFrom(t.matrix).invert() : e.identity();
	if (t.textureSpace === "local") {
		let e = n.getBounds(iv);
		t.width && e.pad(t.width);
		let { x: r, y: a } = e, o = 1 / e.width, s = 1 / e.height, c = -r * o, l = -a * s, u = i.a, d = i.b, f = i.c, p = i.d;
		i.a *= o, i.b *= o, i.c *= s, i.d *= s, i.tx = c * u + l * f + i.tx, i.ty = c * d + l * p + i.ty;
	} else i.translate(t.texture.frame.x, t.texture.frame.y), i.scale(1 / t.texture.source.width, 1 / t.texture.source.height);
	let a = t.texture.source.style;
	return !(t.fill instanceof O_) && a.addressMode === "clamp-to-edge" && (a.addressMode = "repeat", a.update()), r && i.append(rv.copyFrom(r).invert()), i;
}
var rv, iv, av = o((() => {
	R(), dt(), k_(), rv = new L(), iv = new W();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/buildContextBatches.mjs
function ov(e, t) {
	let { geometryData: n, batches: r } = t;
	r.length = 0, n.indices.length = 0, n.vertices.length = 0, n.uvs.length = 0;
	for (let t = 0; t < e.instructions.length; t++) {
		let i = e.instructions[t];
		if (i.action === "texture") sv(i.data, r, n);
		else if (i.action === "fill" || i.action === "stroke") {
			let e = i.action === "stroke", t = i.data.path.shapePath, a = i.data.style, o = i.data.hole;
			e && o && cv(o.shapePath, a, !0, r, n), o && (t.shapePrimitives[t.shapePrimitives.length - 1].holes = o.shapePath.shapePrimitives), cv(t, a, e, r, n);
		}
	}
}
function sv(e, t, n) {
	let r = [], i = uv.rectangle, a = dv;
	a.x = e.dx, a.y = e.dy, a.width = e.dw, a.height = e.dh;
	let o = e.transform;
	if (!i.build(a, r)) return;
	let { vertices: s, uvs: c, indices: l } = n, u = l.length, d = s.length / 2;
	o && I_(r, o), i.triangulate(r, s, 2, d, l, u);
	let f = e.image, p = f.uvs;
	c.push(p.x0, p.y0, p.x1, p.y1, p.x3, p.y3, p.x2, p.y2);
	let m = Ge.get(z_);
	m.indexOffset = u, m.indexSize = l.length - u, m.attributeOffset = d, m.attributeSize = s.length / 2 - d, m.baseColor = e.style, m.alpha = e.alpha, m.texture = f, m.geometryData = n, t.push(m);
}
function cv(e, t, n, r, i) {
	let { vertices: a, uvs: o, indices: s } = i;
	e.shapePrimitives.forEach(({ shape: e, transform: c, holes: l }) => {
		let u = [], d = uv[e.type];
		if (!d.build(e, u)) return;
		let f = s.length, p = a.length / 2, m = "triangle-list";
		if (c && I_(u, c), n) {
			let n = e.closePath ?? !0, r = t;
			r.pixelLine ? (G_(u, n, a, s), m = "line-list") : x_(u, r, !1, n, a, s);
		} else if (l) {
			let e = [], t = u.slice();
			lv(l).forEach((n) => {
				e.push(t.length / 2), t.push(...n);
			}), q_(t, e, a, 2, p, s, f);
		} else d.triangulate(u, a, 2, p, s, f);
		let h = o.length / 2, g = t.texture;
		if (g !== K.WHITE) {
			let n = nv(fv, t, e, c);
			N_(a, 2, p, o, h, 2, a.length / 2 - p, n);
		} else P_(o, h, 2, a.length / 2 - p);
		let _ = Ge.get(z_);
		_.indexOffset = f, _.indexSize = s.length - f, _.attributeOffset = p, _.attributeSize = a.length / 2 - p, _.baseColor = t.color, _.alpha = t.alpha, _.texture = g, _.geometryData = i, _.topology = m, r.push(_);
	});
}
function lv(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) {
		let r = e[n].shape, i = [];
		uv[r.type].build(r, i) && t.push(i);
	}
	return t;
}
var uv, dv, fv, pv = o((() => {
	g(), R(), dt(), F_(), L_(), q(), Ke(), B_(), W_(), S_(), K_(), Z_(), $_(), tv(), av(), J_(), uv = {}, h.handleByMap(f.ShapeBuilder, uv), h.add(Q_, X_, ev, V_, H_, U_), dv = new W(), fv = new L();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/canvas/CanvasGraphicsAdaptor.mjs
function mv(e, t, n) {
	e.beginPath();
	for (let r = 0; r < n.length; r += 3) {
		let i = n[r] * 2, a = n[r + 1] * 2, o = n[r + 2] * 2;
		e.moveTo(t[i], t[i + 1]), e.lineTo(t[a], t[a + 1]), e.lineTo(t[o], t[o + 1]), e.closePath();
	}
	e.fill();
}
function hv(e) {
	return `#${(e & 16777215).toString(16).padStart(6, "0")}`;
}
function gv(e, t, n, r, i, a) {
	a = Math.max(0, Math.min(a, Math.min(r, i) / 2)), e.moveTo(t + a, n), e.lineTo(t + r - a, n), e.quadraticCurveTo(t + r, n, t + r, n + a), e.lineTo(t + r, n + i - a), e.quadraticCurveTo(t + r, n + i, t + r - a, n + i), e.lineTo(t + a, n + i), e.quadraticCurveTo(t, n + i, t, n + i - a), e.lineTo(t, n + a), e.quadraticCurveTo(t, n, t + a, n);
}
function _v(e, t) {
	switch (t.type) {
		case "rectangle": {
			let n = t;
			e.rect(n.x, n.y, n.width, n.height);
			break;
		}
		case "roundedRectangle": {
			let n = t;
			gv(e, n.x, n.y, n.width, n.height, n.radius);
			break;
		}
		case "circle": {
			let n = t;
			e.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
			break;
		}
		case "ellipse": {
			let n = t;
			e.ellipse ? e.ellipse(n.x, n.y, n.halfWidth, n.halfHeight, 0, 0, Math.PI * 2) : (e.save(), e.translate(n.x, n.y), e.scale(n.halfWidth, n.halfHeight), e.arc(0, 0, 1, 0, Math.PI * 2), e.restore());
			break;
		}
		case "triangle": {
			let n = t;
			e.moveTo(n.x, n.y), e.lineTo(n.x2, n.y2), e.lineTo(n.x3, n.y3), e.closePath();
			break;
		}
		default: {
			let n = t, r = n.points;
			if (!r?.length) break;
			e.moveTo(r[0], r[1]);
			for (let t = 2; t < r.length; t += 2) e.lineTo(r[t], r[t + 1]);
			n.closePath && e.closePath();
			break;
		}
	}
}
function vv(e, t) {
	if (!t?.length) return !1;
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (!r?.shape) continue;
		let i = r.transform, a = i && !i.isIdentity();
		a && (e.save(), e.transform(i.a, i.b, i.c, i.d, i.tx, i.ty)), _v(e, r.shape), a && e.restore();
	}
	return !0;
}
function yv(e, t, n, r) {
	let i = e.fill;
	if (i instanceof O_) {
		i.buildGradient();
		let a = i.texture;
		if (a) {
			let o = Q.getTintedPattern(a, t), s = n ? wv.copyFrom(n).scale(a.source.pixelWidth, a.source.pixelHeight) : wv.copyFrom(i.transform);
			return r && !e.textureSpace && s.append(r), Q.applyPatternTransform(o, s), o;
		}
	}
	if (i instanceof j_) {
		let e = Q.getTintedPattern(i.texture, t);
		return Q.applyPatternTransform(e, i.transform), e;
	}
	let a = e.texture;
	if (a && a !== K.WHITE) {
		if (!a.source.resource) return bv;
		let r = Q.getTintedPattern(a, t), i = n ? wv.copyFrom(n).scale(a.source.pixelWidth, a.source.pixelHeight) : e.matrix;
		return Q.applyPatternTransform(r, i), r;
	}
	return hv(t);
}
var bv, xv, Sv, Cv, wv, Tv, Ev = o((() => {
	g(), vn(), R(), p_(), q(), Mt(), Et(), S_(), k_(), M_(), pv(), av(), bv = "#808080", xv = new L(), Sv = new L(), Cv = new L(), wv = new L(), Tv = class {
		constructor() {
			this.shader = null;
		}
		contextChange(e) {}
		execute(e, t) {
			let n = e.renderer, r = n.canvasContext, i = r.activeContext, a = t.groupTransform, o = n.globalUniforms.globalUniformData?.worldColor ?? 4294967295, s = t.groupColorAlpha, c = (o >>> 24 & 255) / 255, l = (s >>> 24 & 255) / 255, u = n.filter?.alphaMultiplier ?? 1, d = c * l * u;
			if (d <= 0) return;
			let f = o & 16777215, p = At(Tt(s & 16777215, f)), m = n._roundPixels | t._roundPixels;
			i.save(), r.setContextTransform(a, m === 1), r.setBlendMode(t.groupBlendMode);
			let h = t.context.instructions;
			for (let e = 0; e < h.length; e++) {
				let t = h[e];
				if (t.action === "texture") {
					let e = t.data, n = e.image, o = n ? Q.getCanvasSource(n) : null;
					if (!o) continue;
					let s = e.alpha * d;
					if (s <= 0) continue;
					let c = Tt(e.style, p);
					i.globalAlpha = s;
					let l = o;
					c !== 16777215 && (l = Q.getTintedCanvas({ texture: n }, c));
					let u = n.frame, f = n.source._resolution ?? n.source.resolution ?? 1, h = u.x * f, g = u.y * f, _ = u.width * f, v = u.height * f;
					l !== o && (h = 0, g = 0);
					let y = e.transform, b = y && !y.isIdentity(), x = n.rotate;
					b || x ? (xv.copyFrom(a), b && xv.append(y), x && G.matrixAppendRotationInv(xv, x, e.dx, e.dy, e.dw, e.dh), r.setContextTransform(xv, m === 1)) : r.setContextTransform(a, m === 1), i.drawImage(l, h, g, l === o ? _ : l.width, l === o ? v : l.height, x ? 0 : e.dx, x ? 0 : e.dy, e.dw, e.dh), (b || x) && r.setContextTransform(a, m === 1);
					continue;
				}
				let n = t.data, o = n?.path?.shapePath;
				if (!o?.shapePrimitives?.length) continue;
				let s = n.style, c = Tt(s.color, p), l = s.alpha * d;
				if (l <= 0) continue;
				let u = t.action === "stroke";
				if (i.globalAlpha = l, u) {
					let e = s;
					i.lineWidth = e.width, i.lineCap = e.cap, i.lineJoin = e.join, i.miterLimit = e.miterLimit;
				}
				let f = o.shapePrimitives;
				if (!u && n.hole?.shapePath?.shapePrimitives?.length) {
					let e = f[f.length - 1];
					e.holes = n.hole.shapePath.shapePrimitives;
				}
				for (let e = 0; e < f.length; e++) {
					let t = f[e];
					if (!t?.shape) continue;
					let n = t.transform, r = n && !n.isIdentity(), o = s.texture && s.texture !== K.WHITE, l = s.textureSpace === "global" ? n : null, d = yv(s, c, o ? nv(Sv, s, t.shape, l) : null, r ? Cv.copyFrom(a).append(n) : a);
					if (r && (i.save(), i.transform(n.a, n.b, n.c, n.d, n.tx, n.ty)), u) {
						let e = s;
						if (e.alignment !== .5 && !e.pixelLine) {
							let n = [], r = [], a = [];
							uv[t.shape.type]?.build(t.shape, n) ? (x_(n, e, !1, t.shape.closePath ?? !0, r, a), i.fillStyle = d, mv(i, r, a)) : (i.strokeStyle = d, i.beginPath(), _v(i, t.shape), i.stroke());
						} else i.strokeStyle = d, i.beginPath(), _v(i, t.shape), i.stroke();
					} else i.fillStyle = d, i.beginPath(), _v(i, t.shape), vv(i, t.holes) ? i.fill("evenodd") : i.fill();
					r && i.restore();
				}
			}
			i.restore();
		}
		destroy() {
			this.shader = null;
		}
	}, Tv.extension = {
		type: [f.CanvasPipesAdaptor],
		name: "graphics"
	};
})), Dv, Ov, kv = o((() => {
	g(), vn(), R(), Mt(), Et(), p_(), Dv = class e {
		static _getPatternRepeat(e, t) {
			let n = e && e !== "clamp-to-edge", r = t && t !== "clamp-to-edge";
			return n && r ? "repeat" : n ? "repeat-x" : r ? "repeat-y" : "no-repeat";
		}
		start(e, t, n) {}
		execute(t, n) {
			let r = n.elements;
			if (!r || !r.length) return;
			let i = t.renderer, a = i.canvasContext, o = a.activeContext;
			for (let t = 0; t < r.length; t++) {
				let s = r[t];
				if (!s.packAsQuad) continue;
				let c = s, l = c.texture, u = l ? Q.getCanvasSource(l) : null;
				if (!u) continue;
				let d = l.source.style, f = a.smoothProperty, p = d.scaleMode !== "nearest";
				o[f] !== p && (o[f] = p), a.setBlendMode(n.blendMode);
				let m = i.globalUniforms.globalUniformData?.worldColor ?? 4294967295, h = c.color, g = (m >>> 24 & 255) / 255, _ = (h >>> 24 & 255) / 255, v = i.filter?.alphaMultiplier ?? 1, y = g * _ * v;
				if (y <= 0) continue;
				o.globalAlpha = y;
				let b = m & 16777215, x = At(Tt(h & 16777215, b)), S = l.frame, C = d.addressModeU ?? d.addressMode, w = d.addressModeV ?? d.addressMode, T = e._getPatternRepeat(C, w), E = l.source._resolution ?? l.source.resolution ?? 1, D = c.renderable?.renderGroup?.isCachedAsTexture, O = S.x * E, k = S.y * E, A = S.width * E, j = S.height * E, M = c.bounds, N = i.renderTarget.renderTarget.isRoot, ee = M.minX, te = M.minY, ne = M.maxX - M.minX, re = M.maxY - M.minY, ie = l.rotate, P = l.uvs, ae = Math.min(P.x0, P.x1, P.x2, P.x3, P.y0, P.y1, P.y2, P.y3), oe = Math.max(P.x0, P.x1, P.x2, P.x3, P.y0, P.y1, P.y2, P.y3), se = T !== "no-repeat" && (ae < 0 || oe > 1), ce = ie && !(!se && (x !== 16777215 || ie));
				ce ? (e._tempPatternMatrix.copyFrom(c.transform), G.matrixAppendRotationInv(e._tempPatternMatrix, ie, ee, te, ne, re), a.setContextTransform(e._tempPatternMatrix, c.roundPixels === 1, void 0, D && N)) : a.setContextTransform(c.transform, c.roundPixels === 1, void 0, D && N);
				let le = ce ? 0 : ee, ue = ce ? 0 : te, de = ne, fe = re;
				if (se) {
					let t = u, n = x !== 16777215 && !ie, r = S.width <= l.source.width && S.height <= l.source.height;
					n && r && (t = Q.getTintedCanvas({ texture: l }, x));
					let i = o.createPattern(t, T);
					if (!i) continue;
					let a = de, s = fe;
					if (a === 0 || s === 0) continue;
					let c = 1 / a, d = 1 / s, f = (P.x1 - P.x0) * c, p = (P.y1 - P.y0) * c, m = (P.x3 - P.x0) * d, h = (P.y3 - P.y0) * d, g = P.x0 - f * le - m * ue, _ = P.y0 - p * le - h * ue, v = l.source.pixelWidth, y = l.source.pixelHeight;
					e._tempPatternMatrix.set(f * v, p * y, m * v, h * y, g * v, _ * y), Q.applyPatternTransform(i, e._tempPatternMatrix), o.fillStyle = i, o.fillRect(le, ue, de, fe);
				} else {
					let e = x !== 16777215 || ie ? Q.getTintedCanvas({ texture: l }, x) : u, t = e !== u;
					o.drawImage(e, t ? 0 : O, t ? 0 : k, t ? e.width : A, t ? e.height : j, le, ue, de, fe);
				}
			}
		}
	}, Dv._tempPatternMatrix = new L(), Dv.extension = {
		type: [f.CanvasPipesAdaptor],
		name: "batch"
	}, Ov = Dv;
})), Av, jv = o((() => {
	g(), Av = class {
		constructor(e) {
			this._colorStack = [], this._colorStackIndex = 0, this._currentColor = 0, this._renderer = e;
		}
		buildStart() {
			this._colorStack[0] = 15, this._colorStackIndex = 1, this._currentColor = 15;
		}
		push(e, t, n) {
			this._renderer.renderPipes.batch.break(n);
			let r = this._colorStack;
			r[this._colorStackIndex] = r[this._colorStackIndex - 1] & e.mask;
			let i = this._colorStack[this._colorStackIndex];
			i !== this._currentColor && (this._currentColor = i, n.add({
				renderPipeId: "colorMask",
				colorMask: i,
				canBundle: !1
			})), this._colorStackIndex++;
		}
		pop(e, t, n) {
			this._renderer.renderPipes.batch.break(n);
			let r = this._colorStack;
			this._colorStackIndex--;
			let i = r[this._colorStackIndex - 1];
			i !== this._currentColor && (this._currentColor = i, n.add({
				renderPipeId: "colorMask",
				colorMask: i,
				canBundle: !1
			}));
		}
		execute(e) {}
		destroy() {
			this._renderer = null, this._colorStack = null;
		}
	}, Av.extension = {
		type: [f.CanvasPipes],
		name: "colorMask"
	};
})), Mv = /* @__PURE__ */ s(((e, t) => {
	t.exports = i;
	var n = {
		a: 7,
		c: 6,
		h: 1,
		l: 2,
		m: 2,
		q: 4,
		s: 4,
		t: 2,
		v: 1,
		z: 0
	}, r = /([astvzqmhlc])([^astvzqmhlc]*)/gi;
	function i(e) {
		var t = [];
		return e.replace(r, function(e, r, i) {
			var a = r.toLowerCase();
			for (i = o(i), a == "m" && i.length > 2 && (t.push([r].concat(i.splice(0, 2))), a = "l", r = r == "m" ? "l" : "L");;) {
				if (i.length == n[a]) return i.unshift(r), t.push(i);
				if (i.length < n[a]) throw Error("malformed path data");
				t.push([r].concat(i.splice(0, n[a])));
			}
		}), t;
	}
	var a = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;
	function o(e) {
		var t = e.match(a);
		return t ? t.map(Number) : [];
	}
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGPath.mjs
function Nv(e, t) {
	let n = (0, Pv.default)(e), r = [], i = null, a = 0, o = 0;
	for (let e = 0; e < n.length; e++) {
		let s = n[e], c = s[0], l = s;
		switch (c) {
			case "M":
				a = l[1], o = l[2], t.moveTo(a, o);
				break;
			case "m":
				a += l[1], o += l[2], t.moveTo(a, o);
				break;
			case "H":
				a = l[1], t.lineTo(a, o);
				break;
			case "h":
				a += l[1], t.lineTo(a, o);
				break;
			case "V":
				o = l[1], t.lineTo(a, o);
				break;
			case "v":
				o += l[1], t.lineTo(a, o);
				break;
			case "L":
				a = l[1], o = l[2], t.lineTo(a, o);
				break;
			case "l":
				a += l[1], o += l[2], t.lineTo(a, o);
				break;
			case "C":
				a = l[5], o = l[6], t.bezierCurveTo(l[1], l[2], l[3], l[4], a, o);
				break;
			case "c":
				t.bezierCurveTo(a + l[1], o + l[2], a + l[3], o + l[4], a + l[5], o + l[6]), a += l[5], o += l[6];
				break;
			case "S":
				a = l[3], o = l[4], t.bezierCurveToShort(l[1], l[2], a, o);
				break;
			case "s":
				t.bezierCurveToShort(a + l[1], o + l[2], a + l[3], o + l[4]), a += l[3], o += l[4];
				break;
			case "Q":
				a = l[3], o = l[4], t.quadraticCurveTo(l[1], l[2], a, o);
				break;
			case "q":
				t.quadraticCurveTo(a + l[1], o + l[2], a + l[3], o + l[4]), a += l[3], o += l[4];
				break;
			case "T":
				a = l[1], o = l[2], t.quadraticCurveToShort(a, o);
				break;
			case "t":
				a += l[1], o += l[2], t.quadraticCurveToShort(a, o);
				break;
			case "A":
				a = l[6], o = l[7], t.arcToSvg(l[1], l[2], l[3], l[4], l[5], a, o);
				break;
			case "a":
				a += l[6], o += l[7], t.arcToSvg(l[1], l[2], l[3], l[4], l[5], a, o);
				break;
			case "Z":
			case "z":
				t.closePath(), r.length > 0 && (i = r.pop(), i ? (a = i.startX, o = i.startY) : (a = 0, o = 0)), i = null;
				break;
			default: H(`Unknown SVG path command: ${c}`);
		}
		c !== "Z" && c !== "z" && i === null && (i = {
			startX: a,
			startY: o
		}, r.push(i));
	}
	return t;
}
var Pv, Fv = o((() => {
	Pv = /* @__PURE__ */ u(Mv(), 1), U();
})), Iv, Lv, Rv, zv, Bv = o((() => {
	g(), Uc(), pd(), Yt(), If(), Le(), Ke(), pv(), Iv = class {
		constructor() {
			this.batches = [], this.geometryData = {
				vertices: [],
				uvs: [],
				indices: []
			};
		}
		reset() {
			this.batches && this.batches.forEach((e) => {
				Ge.return(e);
			}), this.graphicsData && Ge.return(this.graphicsData), this.isBatchable = !1, this.context = null, this.batches.length = 0, this.geometryData.indices.length = 0, this.geometryData.vertices.length = 0, this.geometryData.uvs.length = 0, this.graphicsData = null;
		}
		destroy() {
			this.reset(), this.batches = null, this.geometryData = null;
		}
	}, Lv = class {
		constructor() {
			this.instructions = new Jt();
		}
		init(e) {
			let t = e.maxTextures;
			this.batcher ? this.batcher._updateMaxTextures(t) : this.batcher = new fd({ maxTextures: t }), this.instructions.reset();
		}
		get geometry() {
			return V(Fe, "GraphicsContextRenderData#geometry is deprecated, please use batcher.geometry instead."), this.batcher.geometry;
		}
		destroy() {
			this.batcher.destroy(), this.instructions.destroy(), this.batcher = null, this.instructions = null;
		}
	}, Rv = class e {
		constructor(e) {
			this._renderer = e, this._managedContexts = new Ff({
				renderer: e,
				type: "resource",
				name: "graphicsContext"
			});
		}
		init(t) {
			e.defaultOptions.bezierSmoothness = t?.bezierSmoothness ?? e.defaultOptions.bezierSmoothness;
		}
		getContextRenderData(e) {
			return e._gpuData[this._renderer.uid].graphicsData || this._initContextRenderData(e);
		}
		updateGpuContext(e) {
			let t = !!e._gpuData[this._renderer.uid], n = e._gpuData[this._renderer.uid] || this._initContext(e);
			if (e.dirty || !t) {
				t && n.reset(), ov(e, n);
				let r = e.batchMode;
				e.customShader || r === "no-batch" ? n.isBatchable = !1 : r === "auto" ? n.isBatchable = n.geometryData.vertices.length < 400 : n.isBatchable = !0, e.dirty = !1;
			}
			return n;
		}
		getGpuContext(e) {
			return e._gpuData[this._renderer.uid] || this._initContext(e);
		}
		_initContextRenderData(e) {
			let t = Ge.get(Lv, { maxTextures: this._renderer.limits.maxBatchableTextures }), n = e._gpuData[this._renderer.uid], { batches: r, geometryData: i } = n;
			n.graphicsData = t;
			let a = i.vertices.length, o = i.indices.length;
			for (let e = 0; e < r.length; e++) r[e].applyTransform = !1;
			let s = t.batcher;
			s.ensureAttributeBuffer(a), s.ensureIndexBuffer(o), s.begin();
			for (let e = 0; e < r.length; e++) {
				let t = r[e];
				s.add(t);
			}
			s.finish(t.instructions);
			let c = s.geometry;
			c.indexBuffer.setDataWithSize(s.indexBuffer, s.indexSize, !0), c.buffers[0].setDataWithSize(s.attributeBuffer.float32View, s.attributeSize, !0);
			let l = s.batches;
			for (let e = 0; e < l.length; e++) {
				let t = l[e];
				t.bindGroup = Bc(t.textures.textures, t.textures.count, this._renderer.limits.maxBatchableTextures);
			}
			return t;
		}
		_initContext(e) {
			let t = new Iv();
			return t.context = e, e._gpuData[this._renderer.uid] = t, this._managedContexts.add(e), t;
		}
		destroy() {
			this._managedContexts.destroy(), this._renderer = null;
		}
	}, Rv.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "graphicsContext"
	}, Rv.defaultOptions = { bezierSmoothness: .5 }, zv = Rv;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildAdaptiveBezier.mjs
function Vv(e, t, n, r, i, a, o, s, c, l) {
	let u = (Kv - Math.min(.99, Math.max(0, l ?? zv.defaultOptions.bezierSmoothness))) / 1;
	return u *= u, Hv(t, n, r, i, a, o, s, c, e, u), e;
}
function Hv(e, t, n, r, i, a, o, s, c, l) {
	Uv(e, t, n, r, i, a, o, s, c, l, 0), c.push(o, s);
}
function Uv(e, t, n, r, i, a, o, s, c, l, u) {
	if (u > Wv) return;
	let d = Math.PI, f = (e + n) / 2, p = (t + r) / 2, m = (n + i) / 2, h = (r + a) / 2, g = (i + o) / 2, _ = (a + s) / 2, v = (f + m) / 2, y = (p + h) / 2, b = (m + g) / 2, x = (h + _) / 2, S = (v + b) / 2, C = (y + x) / 2;
	if (u > 0) {
		let u = o - e, f = s - t, p = Math.abs((n - o) * f - (r - s) * u), m = Math.abs((i - o) * f - (a - s) * u), h, g;
		if (p > Gv && m > Gv) {
			if ((p + m) * (p + m) <= l * (u * u + f * f)) {
				if (Jv < qv) {
					c.push(S, C);
					return;
				}
				let l = Math.atan2(a - r, i - n);
				if (h = Math.abs(l - Math.atan2(r - t, n - e)), g = Math.abs(Math.atan2(s - a, o - i) - l), h >= d && (h = 2 * d - h), g >= d && (g = 2 * d - g), h + g < Jv) {
					c.push(S, C);
					return;
				}
				if (Yv !== 0) {
					if (h > Yv) {
						c.push(n, r);
						return;
					}
					if (g > Yv) {
						c.push(i, a);
						return;
					}
				}
			}
		} else if (p > Gv) {
			if (p * p <= l * (u * u + f * f)) {
				if (Jv < qv) {
					c.push(S, C);
					return;
				}
				if (h = Math.abs(Math.atan2(a - r, i - n) - Math.atan2(r - t, n - e)), h >= d && (h = 2 * d - h), h < Jv) {
					c.push(n, r), c.push(i, a);
					return;
				}
				if (Yv !== 0 && h > Yv) {
					c.push(n, r);
					return;
				}
			}
		} else if (m > Gv) {
			if (m * m <= l * (u * u + f * f)) {
				if (Jv < qv) {
					c.push(S, C);
					return;
				}
				if (h = Math.abs(Math.atan2(s - a, o - i) - Math.atan2(a - r, i - n)), h >= d && (h = 2 * d - h), h < Jv) {
					c.push(n, r), c.push(i, a);
					return;
				}
				if (Yv !== 0 && h > Yv) {
					c.push(i, a);
					return;
				}
			}
		} else if (u = S - (e + o) / 2, f = C - (t + s) / 2, u * u + f * f <= l) {
			c.push(S, C);
			return;
		}
	}
	Uv(e, t, f, p, v, y, S, C, c, l, u + 1), Uv(S, C, b, x, g, _, o, s, c, l, u + 1);
}
var Wv, Gv, Kv, qv, Jv, Yv, Xv = o((() => {
	Bv(), Wv = 8, Gv = 1.1920929e-7, Kv = 1, qv = .01, Jv = 0, Yv = 0;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildAdaptiveQuadratic.mjs
function Zv(e, t, n, r, i, a, o, s) {
	let c = (ny - Math.min(.99, Math.max(0, s ?? zv.defaultOptions.bezierSmoothness))) / 1;
	return c *= c, Qv(t, n, r, i, a, o, e, c), e;
}
function Qv(e, t, n, r, i, a, o, s) {
	$v(o, e, t, n, r, i, a, s, 0), o.push(i, a);
}
function $v(e, t, n, r, i, a, o, s, c) {
	if (c > ey) return;
	let l = Math.PI, u = (t + r) / 2, d = (n + i) / 2, f = (r + a) / 2, p = (i + o) / 2, m = (u + f) / 2, h = (d + p) / 2, g = a - t, _ = o - n, v = Math.abs((r - a) * _ - (i - o) * g);
	if (v > ty) {
		if (v * v <= s * (g * g + _ * _)) {
			if (iy < ry) {
				e.push(m, h);
				return;
			}
			let s = Math.abs(Math.atan2(o - i, a - r) - Math.atan2(i - n, r - t));
			if (s >= l && (s = 2 * l - s), s < iy) {
				e.push(m, h);
				return;
			}
		}
	} else if (g = m - (t + a) / 2, _ = h - (n + o) / 2, g * g + _ * _ <= s) {
		e.push(m, h);
		return;
	}
	$v(e, t, n, u, d, m, h, s, c + 1), $v(e, m, h, f, p, a, o, s, c + 1);
}
var ey, ty, ny, ry, iy, ay = o((() => {
	Bv(), ey = 8, ty = 1.1920929e-7, ny = 1, ry = .01, iy = 0;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArc.mjs
function oy(e, t, n, r, i, a, o, s) {
	let c = Math.abs(i - a);
	(!o && i > a || o && a > i) && (c = 2 * Math.PI - c), s || (s = Math.max(6, Math.floor(6 * r ** (1 / 3) * (c / Math.PI)))), s = Math.max(s, 3);
	let l = c / s, u = i;
	l *= o ? -1 : 1;
	for (let i = 0; i < s + 1; i++) {
		let i = Math.cos(u), a = Math.sin(u), o = t + i * r, s = n + a * r;
		e.push(o, s), u += l;
	}
}
var sy = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArcTo.mjs
function cy(e, t, n, r, i, a) {
	let o = e[e.length - 2], s = e[e.length - 1] - n, c = o - t, l = i - n, u = r - t, d = Math.abs(s * u - c * l);
	if (d < 1e-8 || a === 0) {
		(e[e.length - 2] !== t || e[e.length - 1] !== n) && e.push(t, n);
		return;
	}
	let f = s * s + c * c, p = l * l + u * u, m = s * l + c * u, h = a * Math.sqrt(f) / d, g = a * Math.sqrt(p) / d, _ = h * m / f, v = g * m / p, y = h * u + g * c, b = h * l + g * s, x = c * (g + _), S = s * (g + _), C = u * (h + v), w = l * (h + v), T = Math.atan2(S - b, x - y), E = Math.atan2(w - b, C - y);
	oy(e, y + t, b + n, a, T, E, c * l > u * s);
}
var ly = o((() => {
	sy();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/buildCommands/buildArcToSvg.mjs
function uy(e, t) {
	let n = t === -1.5707963267948966 ? -.551915024494 : 4 / 3 * Math.tan(t / 4), r = t === 1.5707963267948966 ? .551915024494 : n, i = Math.cos(e), a = Math.sin(e), o = Math.cos(e + t), s = Math.sin(e + t);
	return [
		{
			x: i - a * r,
			y: a + i * r
		},
		{
			x: o + s * r,
			y: s - o * r
		},
		{
			x: o,
			y: s
		}
	];
}
function dy(e, t, n, r, i, a, o, s = 0, c = 0, l = 0) {
	if (a === 0 || o === 0) return;
	let u = Math.sin(s * fy / 360), d = Math.cos(s * fy / 360), f = d * (t - r) / 2 + u * (n - i) / 2, p = -u * (t - r) / 2 + d * (n - i) / 2;
	if (f === 0 && p === 0) return;
	a = Math.abs(a), o = Math.abs(o);
	let m = f ** 2 / a ** 2 + p ** 2 / o ** 2;
	m > 1 && (a *= Math.sqrt(m), o *= Math.sqrt(m)), gy(t, n, r, i, a, o, c, l, u, d, f, p, py);
	let { ang1: h, ang2: g } = py, { centerX: _, centerY: v } = py, y = Math.abs(g) / (fy / 4);
	Math.abs(1 - y) < 1e-7 && (y = 1);
	let b = Math.max(Math.ceil(y), 1);
	g /= b;
	let x = e[e.length - 2], S = e[e.length - 1], C = {
		x: 0,
		y: 0
	};
	for (let t = 0; t < b; t++) {
		let t = uy(h, g), { x: n, y: r } = my(t[0], a, o, d, u, _, v, C), { x: i, y: s } = my(t[1], a, o, d, u, _, v, C), { x: c, y: l } = my(t[2], a, o, d, u, _, v, C);
		Vv(e, x, S, n, r, i, s, c, l), x = c, S = l, h += g;
	}
}
var fy, py, my, hy, gy, _y = o((() => {
	Xv(), fy = Math.PI * 2, py = {
		centerX: 0,
		centerY: 0,
		ang1: 0,
		ang2: 0
	}, my = ({ x: e, y: t }, n, r, i, a, o, s, c) => {
		e *= n, t *= r;
		let l = i * e - a * t, u = a * e + i * t;
		return c.x = l + o, c.y = u + s, c;
	}, hy = (e, t, n, r) => {
		let i = e * r - t * n < 0 ? -1 : 1, a = e * n + t * r;
		return a > 1 && (a = 1), a < -1 && (a = -1), i * Math.acos(a);
	}, gy = (e, t, n, r, i, a, o, s, c, l, u, d, f) => {
		let p = i ** 2, m = a ** 2, h = u ** 2, g = d ** 2, _ = p * m - p * g - m * h;
		_ < 0 && (_ = 0), _ /= p * g + m * h, _ = Math.sqrt(_) * (o === s ? -1 : 1);
		let v = _ * i / a * d, y = _ * -a / i * u, b = l * v - c * y + (e + n) / 2, x = c * v + l * y + (t + r) / 2, S = (u - v) / i, C = (d - y) / a, w = (-u - v) / i, T = (-d - y) / a, E = hy(1, 0, S, C), D = hy(S, C, w, T);
		s === 0 && D > 0 && (D -= fy), s === 1 && D < 0 && (D += fy), f.centerX = b, f.centerY = x, f.ang1 = E, f.ang2 = D;
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/path/roundShape.mjs
function vy(e, t, n) {
	let r = (e, t) => {
		let n = t.x - e.x, r = t.y - e.y, i = Math.sqrt(n * n + r * r);
		return {
			len: i,
			nx: n / i,
			ny: r / i
		};
	}, i = (t, n) => {
		t === 0 ? e.moveTo(n.x, n.y) : e.lineTo(n.x, n.y);
	}, a = t[t.length - 1];
	for (let o = 0; o < t.length; o++) {
		let s = t[o % t.length], c = s.radius ?? n;
		if (c <= 0) {
			i(o, s), a = s;
			continue;
		}
		let l = t[(o + 1) % t.length], u = r(s, a), d = r(s, l);
		if (u.len < 1e-4 || d.len < 1e-4) {
			i(o, s), a = s;
			continue;
		}
		let f = Math.asin(u.nx * d.ny - u.ny * d.nx), p = 1, m = !1;
		u.nx * d.nx - u.ny * -d.ny < 0 ? f < 0 ? f = Math.PI + f : (f = Math.PI - f, p = -1, m = !0) : f > 0 && (p = -1, m = !0);
		let h = f / 2, g, _ = Math.abs(Math.cos(h) * c / Math.sin(h));
		_ > Math.min(u.len / 2, d.len / 2) ? (_ = Math.min(u.len / 2, d.len / 2), g = Math.abs(_ * Math.sin(h) / Math.cos(h))) : g = c;
		let v = s.x + d.nx * _ + -d.ny * g * p, y = s.y + d.ny * _ + d.nx * g * p, b = Math.atan2(u.ny, u.nx) + Math.PI / 2 * p, x = Math.atan2(d.ny, d.nx) - Math.PI / 2 * p;
		o === 0 && e.moveTo(v + Math.cos(b) * g, y + Math.sin(b) * g), e.arc(v, y, g, b, x, m), a = s;
	}
}
function yy(e, t, n, r) {
	let i = (e, t) => Math.sqrt((e.x - t.x) ** 2 + (e.y - t.y) ** 2), a = (e, t, n) => ({
		x: e.x + (t.x - e.x) * n,
		y: e.y + (t.y - e.y) * n
	}), o = t.length;
	for (let s = 0; s < o; s++) {
		let c = t[(s + 1) % o], l = c.radius ?? n;
		if (l <= 0) {
			s === 0 ? e.moveTo(c.x, c.y) : e.lineTo(c.x, c.y);
			continue;
		}
		let u = t[s], d = t[(s + 2) % o], f = i(u, c), p;
		p = f < 1e-4 ? c : a(c, u, Math.min(f / 2, l) / f);
		let m = i(d, c), h;
		h = m < 1e-4 ? c : a(c, d, Math.min(m / 2, l) / m), s === 0 ? e.moveTo(p.x, p.y) : e.lineTo(p.x, p.y), e.quadraticCurveTo(c.x, c.y, h.x, h.y, r);
	}
}
var by = o((() => {})), xy, Sy, Cy = o((() => {
	fs(), ms(), vs(), dt(), xs(), mt(), Xv(), ay(), sy(), ly(), _y(), by(), xy = new W(), Sy = class {
		constructor(e) {
			this.shapePrimitives = [], this._currentPoly = null, this._bounds = new pt(), this._graphicsPath2D = e, this.signed = e.checkForHoles;
		}
		moveTo(e, t) {
			return this.startPoly(e, t), this;
		}
		lineTo(e, t) {
			this._ensurePoly();
			let n = this._currentPoly.points, r = n[n.length - 2], i = n[n.length - 1];
			return (r !== e || i !== t) && n.push(e, t), this;
		}
		arc(e, t, n, r, i, a) {
			this._ensurePoly(!1);
			let o = this._currentPoly.points;
			return oy(o, e, t, n, r, i, a), this;
		}
		arcTo(e, t, n, r, i) {
			this._ensurePoly();
			let a = this._currentPoly.points;
			return cy(a, e, t, n, r, i), this;
		}
		arcToSvg(e, t, n, r, i, a, o) {
			let s = this._currentPoly.points;
			return dy(s, this._currentPoly.lastX, this._currentPoly.lastY, a, o, e, t, n, r, i), this;
		}
		bezierCurveTo(e, t, n, r, i, a, o) {
			this._ensurePoly();
			let s = this._currentPoly;
			return Vv(this._currentPoly.points, s.lastX, s.lastY, e, t, n, r, i, a, o), this;
		}
		quadraticCurveTo(e, t, n, r, i) {
			this._ensurePoly();
			let a = this._currentPoly;
			return Zv(this._currentPoly.points, a.lastX, a.lastY, e, t, n, r, i), this;
		}
		closePath() {
			return this.endPoly(!0), this;
		}
		addPath(e, t) {
			this.endPoly(), t && !t.isIdentity() && (e = e.clone(!0), e.transform(t));
			let n = this.shapePrimitives, r = n.length;
			for (let t = 0; t < e.instructions.length; t++) {
				let n = e.instructions[t];
				this[n.action](...n.data);
			}
			if (e.checkForHoles && n.length - r > 1) {
				let e = null;
				for (let t = r; t < n.length; t++) {
					let r = n[t];
					if (r.shape.type === "polygon") {
						let i = r.shape, a = e?.shape;
						a && a.containsPolygon(i) ? (e.holes || (e.holes = []), e.holes.push(r), n.copyWithin(t, t + 1), n.length--, t--) : e = r;
					}
				}
			}
			return this;
		}
		finish(e = !1) {
			this.endPoly(e);
		}
		rect(e, t, n, r, i) {
			return this.drawShape(new W(e, t, n, r), i), this;
		}
		circle(e, t, n, r) {
			return this.drawShape(new ds(e, t, n), r), this;
		}
		poly(e, t, n) {
			let r = new _s(e);
			return r.closePath = t, this.drawShape(r, n), this;
		}
		regularPoly(e, t, n, r, i = 0, a) {
			r = Math.max(r | 0, 3);
			let o = -1 * Math.PI / 2 + i, s = Math.PI * 2 / r, c = [];
			for (let i = 0; i < r; i++) {
				let r = o - i * s;
				c.push(e + n * Math.cos(r), t + n * Math.sin(r));
			}
			return this.poly(c, !0, a), this;
		}
		roundPoly(e, t, n, r, i, a = 0, o) {
			if (r = Math.max(r | 0, 3), i <= 0) return this.regularPoly(e, t, n, r, a);
			let s = n * Math.sin(Math.PI / r) - .001;
			i = Math.min(i, s);
			let c = -1 * Math.PI / 2 + a, l = Math.PI * 2 / r, u = (r - 2) * Math.PI / r / 2;
			for (let a = 0; a < r; a++) {
				let r = a * l + c, s = e + n * Math.cos(r), d = t + n * Math.sin(r), f = r + Math.PI + u, p = r - Math.PI - u, m = s + i * Math.cos(f), h = d + i * Math.sin(f), g = s + i * Math.cos(p), _ = d + i * Math.sin(p);
				a === 0 ? this.moveTo(m, h) : this.lineTo(m, h), this.quadraticCurveTo(s, d, g, _, o);
			}
			return this.closePath();
		}
		roundShape(e, t, n = !1, r) {
			return e.length < 3 ? this : (n ? yy(this, e, t, r) : vy(this, e, t), this.closePath());
		}
		filletRect(e, t, n, r, i) {
			if (i === 0) return this.rect(e, t, n, r);
			let a = Math.min(n, r) / 2, o = Math.min(a, Math.max(-a, i)), s = e + n, c = t + r, l = o < 0 ? -o : 0, u = Math.abs(o);
			return this.moveTo(e, t + u).arcTo(e + l, t + l, e + u, t, u).lineTo(s - u, t).arcTo(s - l, t + l, s, t + u, u).lineTo(s, c - u).arcTo(s - l, c - l, e + n - u, c, u).lineTo(e + u, c).arcTo(e + l, c - l, e, c - u, u).closePath();
		}
		chamferRect(e, t, n, r, i, a) {
			if (i <= 0) return this.rect(e, t, n, r);
			let o = Math.min(i, Math.min(n, r) / 2), s = e + n, c = t + r, l = [
				e + o,
				t,
				s - o,
				t,
				s,
				t + o,
				s,
				c - o,
				s - o,
				c,
				e + o,
				c,
				e,
				c - o,
				e,
				t + o
			];
			for (let e = l.length - 1; e >= 2; e -= 2) l[e] === l[e - 2] && l[e - 1] === l[e - 3] && l.splice(e - 1, 2);
			return this.poly(l, !0, a);
		}
		ellipse(e, t, n, r, i) {
			return this.drawShape(new ps(e, t, n, r), i), this;
		}
		roundRect(e, t, n, r, i, a) {
			return this.drawShape(new bs(e, t, n, r, i), a), this;
		}
		drawShape(e, t) {
			return this.endPoly(), this.shapePrimitives.push({
				shape: e,
				transform: t
			}), this;
		}
		startPoly(e, t) {
			let n = this._currentPoly;
			return n && this.endPoly(), n = new _s(), n.points.push(e, t), this._currentPoly = n, this;
		}
		endPoly(e = !1) {
			let t = this._currentPoly;
			return t && t.points.length > 2 && (t.closePath = e, this.shapePrimitives.push({ shape: t })), this._currentPoly = null, this;
		}
		_ensurePoly(e = !0) {
			if (!this._currentPoly && (this._currentPoly = new _s(), e)) {
				let e = this.shapePrimitives[this.shapePrimitives.length - 1];
				if (e) {
					let t = e.shape.x, n = e.shape.y;
					if (e.transform && !e.transform.isIdentity()) {
						let r = e.transform, i = t;
						t = r.a * t + r.c * n + r.tx, n = r.b * i + r.d * n + r.ty;
					}
					this._currentPoly.points.push(t, n);
				} else this._currentPoly.points.push(0, 0);
			}
		}
		buildPath() {
			let e = this._graphicsPath2D;
			this.shapePrimitives.length = 0, this._currentPoly = null;
			for (let t = 0; t < e.instructions.length; t++) {
				let n = e.instructions[t];
				this[n.action](...n.data);
			}
			this.finish();
		}
		get bounds() {
			let e = this._bounds;
			e.clear();
			let t = this.shapePrimitives;
			for (let n = 0; n < t.length; n++) {
				let r = t[n], i = r.shape.getBounds(xy);
				r.transform ? e.addRect(i, r.transform) : e.addRect(i);
			}
			return e;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/path/GraphicsPath.mjs
function wy(e, t) {
	return e ? e.prepend(t) : t.clone();
}
var Ty, Ey = o((() => {
	De(), Ne(), U(), Fv(), Cy(), Ty = class e {
		constructor(e, t = !1) {
			this.instructions = [], this.uid = z("graphicsPath"), this._dirty = !0, this.checkForHoles = t, typeof e == "string" ? Nv(e, this) : this.instructions = e?.slice() ?? [];
		}
		get shapePath() {
			return this._shapePath || (this._shapePath = new Sy(this)), this._dirty && (this._dirty = !1, this._shapePath.buildPath()), this._shapePath;
		}
		addPath(e, t) {
			return e = e.clone(), this.instructions.push({
				action: "addPath",
				data: [e, t]
			}), this._dirty = !0, this;
		}
		arc(...e) {
			return this.instructions.push({
				action: "arc",
				data: e
			}), this._dirty = !0, this;
		}
		arcTo(...e) {
			return this.instructions.push({
				action: "arcTo",
				data: e
			}), this._dirty = !0, this;
		}
		arcToSvg(...e) {
			return this.instructions.push({
				action: "arcToSvg",
				data: e
			}), this._dirty = !0, this;
		}
		bezierCurveTo(...e) {
			return this.instructions.push({
				action: "bezierCurveTo",
				data: e
			}), this._dirty = !0, this;
		}
		bezierCurveToShort(e, t, n, r, i) {
			let a = this.instructions[this.instructions.length - 1], o = this.getLastPoint(I.shared), s = 0, c = 0;
			if (!a || a.action !== "bezierCurveTo") s = o.x, c = o.y;
			else {
				s = a.data[2], c = a.data[3];
				let e = o.x, t = o.y;
				s = e + (e - s), c = t + (t - c);
			}
			return this.instructions.push({
				action: "bezierCurveTo",
				data: [
					s,
					c,
					e,
					t,
					n,
					r,
					i
				]
			}), this._dirty = !0, this;
		}
		closePath() {
			return this.instructions.push({
				action: "closePath",
				data: []
			}), this._dirty = !0, this;
		}
		ellipse(...e) {
			return this.instructions.push({
				action: "ellipse",
				data: e
			}), this._dirty = !0, this;
		}
		lineTo(...e) {
			return this.instructions.push({
				action: "lineTo",
				data: e
			}), this._dirty = !0, this;
		}
		moveTo(...e) {
			return this.instructions.push({
				action: "moveTo",
				data: e
			}), this;
		}
		quadraticCurveTo(...e) {
			return this.instructions.push({
				action: "quadraticCurveTo",
				data: e
			}), this._dirty = !0, this;
		}
		quadraticCurveToShort(e, t, n) {
			let r = this.instructions[this.instructions.length - 1], i = this.getLastPoint(I.shared), a = 0, o = 0;
			if (!r || r.action !== "quadraticCurveTo") a = i.x, o = i.y;
			else {
				a = r.data[0], o = r.data[1];
				let e = i.x, t = i.y;
				a = e + (e - a), o = t + (t - o);
			}
			return this.instructions.push({
				action: "quadraticCurveTo",
				data: [
					a,
					o,
					e,
					t,
					n
				]
			}), this._dirty = !0, this;
		}
		rect(e, t, n, r, i) {
			return this.instructions.push({
				action: "rect",
				data: [
					e,
					t,
					n,
					r,
					i
				]
			}), this._dirty = !0, this;
		}
		circle(e, t, n, r) {
			return this.instructions.push({
				action: "circle",
				data: [
					e,
					t,
					n,
					r
				]
			}), this._dirty = !0, this;
		}
		roundRect(...e) {
			return this.instructions.push({
				action: "roundRect",
				data: e
			}), this._dirty = !0, this;
		}
		poly(...e) {
			return this.instructions.push({
				action: "poly",
				data: e
			}), this._dirty = !0, this;
		}
		regularPoly(...e) {
			return this.instructions.push({
				action: "regularPoly",
				data: e
			}), this._dirty = !0, this;
		}
		roundPoly(...e) {
			return this.instructions.push({
				action: "roundPoly",
				data: e
			}), this._dirty = !0, this;
		}
		roundShape(...e) {
			return this.instructions.push({
				action: "roundShape",
				data: e
			}), this._dirty = !0, this;
		}
		filletRect(...e) {
			return this.instructions.push({
				action: "filletRect",
				data: e
			}), this._dirty = !0, this;
		}
		chamferRect(...e) {
			return this.instructions.push({
				action: "chamferRect",
				data: e
			}), this._dirty = !0, this;
		}
		star(e, t, n, r, i, a, o) {
			i || (i = r / 2);
			let s = -1 * Math.PI / 2 + a, c = n * 2, l = Math.PI * 2 / c, u = [];
			for (let n = 0; n < c; n++) {
				let a = n % 2 ? i : r, o = n * l + s;
				u.push(e + a * Math.cos(o), t + a * Math.sin(o));
			}
			return this.poly(u, !0, o), this;
		}
		clone(t = !1) {
			let n = new e();
			if (n.checkForHoles = this.checkForHoles, !t) n.instructions = this.instructions.slice();
			else for (let e = 0; e < this.instructions.length; e++) {
				let t = this.instructions[e];
				n.instructions.push({
					action: t.action,
					data: t.data.slice()
				});
			}
			return n;
		}
		clear() {
			return this.instructions.length = 0, this._dirty = !0, this;
		}
		transform(e) {
			if (e.isIdentity()) return this;
			let t = e.a, n = e.b, r = e.c, i = e.d, a = e.tx, o = e.ty, s = 0, c = 0, l = 0, u = 0, d = 0, f = 0, p = 0, m = 0;
			for (let h = 0; h < this.instructions.length; h++) {
				let g = this.instructions[h], _ = g.data;
				switch (g.action) {
					case "moveTo":
					case "lineTo":
						s = _[0], c = _[1], _[0] = t * s + r * c + a, _[1] = n * s + i * c + o;
						break;
					case "bezierCurveTo":
						l = _[0], u = _[1], d = _[2], f = _[3], s = _[4], c = _[5], _[0] = t * l + r * u + a, _[1] = n * l + i * u + o, _[2] = t * d + r * f + a, _[3] = n * d + i * f + o, _[4] = t * s + r * c + a, _[5] = n * s + i * c + o;
						break;
					case "quadraticCurveTo":
						l = _[0], u = _[1], s = _[2], c = _[3], _[0] = t * l + r * u + a, _[1] = n * l + i * u + o, _[2] = t * s + r * c + a, _[3] = n * s + i * c + o;
						break;
					case "arcToSvg":
						s = _[5], c = _[6], p = _[0], m = _[1], _[0] = t * p + r * m, _[1] = n * p + i * m, _[5] = t * s + r * c + a, _[6] = n * s + i * c + o;
						break;
					case "circle":
						_[4] = wy(_[3], e);
						break;
					case "rect":
						_[4] = wy(_[4], e);
						break;
					case "ellipse":
						_[8] = wy(_[8], e);
						break;
					case "roundRect":
						_[5] = wy(_[5], e);
						break;
					case "addPath":
						_[0].transform(e);
						break;
					case "poly":
						_[2] = wy(_[2], e);
						break;
					default:
						H("unknown transform action", g.action);
						break;
				}
			}
			return this._dirty = !0, this;
		}
		get bounds() {
			return this.shapePath.bounds;
		}
		getLastPoint(e) {
			let t = this.instructions.length - 1, n = this.instructions[t];
			if (!n) return e.x = 0, e.y = 0, e;
			for (; n.action === "closePath";) {
				if (t--, t < 0) return e.x = 0, e.y = 0, e;
				n = this.instructions[t];
			}
			switch (n.action) {
				case "moveTo":
				case "lineTo":
					e.x = n.data[0], e.y = n.data[1];
					break;
				case "quadraticCurveTo":
					e.x = n.data[2], e.y = n.data[3];
					break;
				case "bezierCurveTo":
					e.x = n.data[4], e.y = n.data[5];
					break;
				case "arc":
				case "arcToSvg":
					e.x = n.data[5], e.y = n.data[6];
					break;
				case "addPath":
					n.data[0].getLastPoint(e);
					break;
			}
			return e;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGFloatAttribute.mjs
function Dy(e, t, n) {
	let r = e.getAttribute(t);
	return r ? Number(r) : n;
}
var Oy = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGDefinitions.mjs
function ky(e, t) {
	let n = e.querySelectorAll("defs");
	for (let e = 0; e < n.length; e++) {
		let r = n[e];
		for (let e = 0; e < r.children.length; e++) {
			let n = r.children[e];
			switch (n.nodeName.toLowerCase()) {
				case "lineargradient":
					t.defs[n.id] = Ay(n);
					break;
				case "radialgradient":
					t.defs[n.id] = jy(n);
					break;
				default: break;
			}
		}
	}
}
function Ay(e) {
	let t = new O_(Dy(e, "x1", 0), Dy(e, "y1", 0), Dy(e, "x2", 1), Dy(e, "y2", 0), (e.getAttribute("gradientUnits") || "objectBoundingBox") === "objectBoundingBox" ? "local" : "global");
	for (let n = 0; n < e.children.length; n++) {
		let r = e.children[n], i = Dy(r, "offset", 0), a = F.shared.setValue(r.getAttribute("stop-color")).toNumber();
		t.addColorStop(i, a);
	}
	return t;
}
function jy(e) {
	return H("[SVG Parser] Radial gradients are not yet supported"), new O_(0, 0, 1, 0);
}
var My = o((() => {
	ye(), U(), k_(), Oy();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/extractSvgUrlId.mjs
function Ny(e) {
	let t = e.match(/url\s*\(\s*['"]?\s*#([^'"\s)]+)\s*['"]?\s*\)/i);
	return t ? t[1] : "";
}
var Py = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/parseSVGStyle.mjs
function Fy(e, t) {
	let n = e.getAttribute("style"), r = {}, i = {}, a = {
		strokeStyle: r,
		fillStyle: i,
		useFill: !1,
		useStroke: !1
	};
	for (let n in Ly) {
		let r = e.getAttribute(n);
		r && Iy(t, a, n, r.trim());
	}
	if (n) {
		let e = n.split(";");
		for (let n = 0; n < e.length; n++) {
			let [r, i] = e[n].trim().split(":");
			Ly[r] && Iy(t, a, r, i.trim());
		}
	}
	return {
		strokeStyle: a.useStroke ? r : null,
		fillStyle: a.useFill ? i : null,
		useFill: a.useFill,
		useStroke: a.useStroke
	};
}
function Iy(e, t, n, r) {
	switch (n) {
		case "stroke":
			if (r !== "none") {
				if (r.startsWith("url(")) {
					let n = Ny(r);
					t.strokeStyle.fill = e.defs[n];
				} else t.strokeStyle.color = F.shared.setValue(r).toNumber();
				t.useStroke = !0;
			}
			break;
		case "stroke-width":
			t.strokeStyle.width = Number(r);
			break;
		case "fill":
			if (r !== "none") {
				if (r.startsWith("url(")) {
					let n = Ny(r);
					t.fillStyle.fill = e.defs[n];
				} else t.fillStyle.color = F.shared.setValue(r).toNumber();
				t.useFill = !0;
			}
			break;
		case "fill-opacity":
			t.fillStyle.alpha = Number(r);
			break;
		case "stroke-opacity":
			t.strokeStyle.alpha = Number(r);
			break;
		case "opacity":
			t.fillStyle.alpha = Number(r), t.strokeStyle.alpha = Number(r);
			break;
	}
}
var Ly, Ry = o((() => {
	ye(), Py(), Ly = {
		fill: {
			type: "paint",
			default: 0
		},
		"fill-opacity": {
			type: "number",
			default: 1
		},
		stroke: {
			type: "paint",
			default: 0
		},
		"stroke-width": {
			type: "number",
			default: 1
		},
		"stroke-opacity": {
			type: "number",
			default: 1
		},
		"stroke-linecap": {
			type: "string",
			default: "butt"
		},
		"stroke-linejoin": {
			type: "string",
			default: "miter"
		},
		"stroke-miterlimit": {
			type: "number",
			default: 10
		},
		"stroke-dasharray": {
			type: "string",
			default: "none"
		},
		"stroke-dashoffset": {
			type: "number",
			default: 0
		},
		opacity: {
			type: "number",
			default: 1
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/fillOperations.mjs
function zy(e) {
	if (e.length <= 2) return !0;
	let t = e.map((e) => e.area).sort((e, t) => t - e), [n, r] = t, i = t[t.length - 1], a = n / r, o = r / i;
	return !(a > 3 && o < 2);
}
var By = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/utils/pathOperations.mjs
function Vy(e) {
	return e.split(/(?=[Mm])/).filter((e) => e.trim().length > 0);
}
function Hy(e) {
	let t = e.match(/[-+]?[0-9]*\.?[0-9]+/g);
	if (!t || t.length < 4) return 0;
	let n = t.map(Number), r = [], i = [];
	for (let e = 0; e < n.length; e += 2) e + 1 < n.length && (r.push(n[e]), i.push(n[e + 1]));
	if (r.length === 0 || i.length === 0) return 0;
	let a = Math.min(...r), o = Math.max(...r), s = Math.min(...i), c = Math.max(...i);
	return (o - a) * (c - s);
}
function Uy(e, t) {
	let n = new Ty(e, !1);
	for (let e of n.instructions) t.instructions.push(e);
}
var Wy = o((() => {
	Ey();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/svg/SVGParser.mjs
function Gy(e, t) {
	if (typeof e == "string") {
		let t = document.createElement("div");
		t.innerHTML = e.trim(), e = t.querySelector("svg");
	}
	let n = {
		context: t,
		defs: {},
		path: new Ty()
	};
	ky(e, n);
	let r = e.children, { fillStyle: i, strokeStyle: a } = Fy(e, n);
	for (let e = 0; e < r.length; e++) {
		let t = r[e];
		t.nodeName.toLowerCase() !== "defs" && Ky(t, n, i, a);
	}
	return t;
}
function Ky(e, t, n, r) {
	let i = e.children, { fillStyle: a, strokeStyle: o } = Fy(e, t);
	a && n ? n = {
		...n,
		...a
	} : a && (n = a), o && r ? r = {
		...r,
		...o
	} : o && (r = o);
	let s = !n && !r;
	s && (n = { color: 0 });
	let c, l, u, d, f, p, m, h, g, _, v, y, b, x, S, C, w;
	switch (e.nodeName.toLowerCase()) {
		case "path": {
			x = e.getAttribute("d");
			let i = e.getAttribute("fill-rule"), a = Vy(x), o = i === "evenodd", s = a.length > 1;
			if (o && s) {
				let e = a.map((e) => ({
					path: e,
					area: Hy(e)
				}));
				if (e.sort((e, t) => t.area - e.area), a.length > 3 || !zy(e)) for (let i = 0; i < e.length; i++) {
					let a = e[i], o = i === 0;
					t.context.beginPath();
					let s = new Ty(void 0, !0);
					Uy(a.path, s), t.context.path(s), o ? (n && t.context.fill(n), r && t.context.stroke(r)) : t.context.cut();
				}
				else for (let i = 0; i < e.length; i++) {
					let a = e[i], o = i % 2 == 1;
					t.context.beginPath();
					let s = new Ty(void 0, !0);
					Uy(a.path, s), t.context.path(s), o ? t.context.cut() : (n && t.context.fill(n), r && t.context.stroke(r));
				}
			} else S = new Ty(x, i ? i === "evenodd" : !0), t.context.path(S), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		}
		case "circle":
			m = Dy(e, "cx", 0), h = Dy(e, "cy", 0), g = Dy(e, "r", 0), t.context.ellipse(m, h, g, g), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "rect":
			c = Dy(e, "x", 0), l = Dy(e, "y", 0), C = Dy(e, "width", 0), w = Dy(e, "height", 0), _ = Dy(e, "rx", 0), v = Dy(e, "ry", 0), _ || v ? t.context.roundRect(c, l, C, w, _ || v) : t.context.rect(c, l, C, w), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "ellipse":
			m = Dy(e, "cx", 0), h = Dy(e, "cy", 0), _ = Dy(e, "rx", 0), v = Dy(e, "ry", 0), t.context.beginPath(), t.context.ellipse(m, h, _, v), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "line":
			u = Dy(e, "x1", 0), d = Dy(e, "y1", 0), f = Dy(e, "x2", 0), p = Dy(e, "y2", 0), t.context.beginPath(), t.context.moveTo(u, d), t.context.lineTo(f, p), r && t.context.stroke(r);
			break;
		case "polygon":
			b = e.getAttribute("points"), y = b.match(/-?\d+/g).map((e) => parseInt(e, 10)), t.context.poly(y, !0), n && t.context.fill(n), r && t.context.stroke(r);
			break;
		case "polyline":
			b = e.getAttribute("points"), y = b.match(/-?\d+/g).map((e) => parseInt(e, 10)), t.context.poly(y, !1), r && t.context.stroke(r);
			break;
		case "g":
		case "svg": break;
		default:
			H(`[SVG parser] <${e.nodeName}> elements unsupported`);
			break;
	}
	s && (n = null);
	for (let e = 0; e < i.length; e++) Ky(i[e], t, n, r);
}
var qy = o((() => {
	U(), Ey(), My(), Oy(), Ry(), By(), Wy();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/convertFillInputToFillStyle.mjs
function Jy(e) {
	return F.isColorLike(e);
}
function Yy(e) {
	return e instanceof j_;
}
function Xy(e) {
	return e instanceof O_;
}
function Zy(e) {
	return e instanceof K;
}
function Qy(e, t, n) {
	let r = F.shared.setValue(t ?? 0);
	return e.color = r.toNumber(), e.alpha = r.alpha === 1 ? n.alpha : r.alpha, e.texture = K.WHITE, {
		...n,
		...e
	};
}
function $y(e, t, n) {
	return e.texture = t, {
		...n,
		...e
	};
}
function eb(e, t, n) {
	return e.fill = t, e.color = 16777215, e.texture = t.texture, e.matrix = t.transform, {
		...n,
		...e
	};
}
function tb(e, t, n) {
	return t.buildGradient(), e.fill = t, e.color = 16777215, e.texture = t.texture, e.matrix = t.transform, e.textureSpace = t.textureSpace, {
		...n,
		...e
	};
}
function nb(e, t) {
	let n = {
		...t,
		...e
	}, r = F.shared.setValue(n.color);
	return n.alpha *= r.alpha, n.color = r.toNumber(), n;
}
function rb(e, t) {
	if (e == null) return null;
	let n = {}, r = e;
	return Jy(e) ? Qy(n, e, t) : Zy(e) ? $y(n, e, t) : Yy(e) ? eb(n, e, t) : Xy(e) ? tb(n, e, t) : r.fill && Yy(r.fill) ? eb(r, r.fill, t) : r.fill && Xy(r.fill) ? tb(r, r.fill, t) : nb(r, t);
}
function ib(e, t) {
	let { width: n, alignment: r, miterLimit: i, cap: a, join: o, pixelLine: s, ...c } = t, l = rb(e, c);
	return l ? {
		width: n,
		alignment: r,
		miterLimit: i,
		cap: a,
		join: o,
		pixelLine: s,
		...l
	} : null;
}
var ab = o((() => {
	ye(), q(), k_(), M_();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/graphics/shared/utils/getMaxMiterRatio.mjs
function ob(e, t) {
	let n = 1, r = e.shapePath.shapePrimitives;
	for (let e = 0; e < r.length; e++) {
		let i = r[e].shape;
		if (i.type !== "polygon") continue;
		let a = i.points, o = a.length;
		if (o < 6) continue;
		let s = i.closePath;
		for (let e = 0; e < o; e += 2) {
			if (!s && (e === 0 || e === o - 2)) continue;
			let r = (e - 2 + o) % o, i = (e + 2) % o, c = a[r], l = a[r + 1], u = a[e], d = a[e + 1], f = a[i], p = a[i + 1], m = c - u, h = l - d, g = f - u, _ = p - d, v = m * m + h * h, y = g * g + _ * _;
			if (v < 1e-12 || y < 1e-12) continue;
			let b = (m * g + h * _) / Math.sqrt(v * y);
			b < -1 ? b = -1 : b > 1 && (b = 1);
			let x = Math.sqrt((1 - b) * .5);
			if (x < 1e-6) continue;
			let S = Math.min(1 / x, t);
			S > n && (n = S);
		}
	}
	return n;
}
var sb = o((() => {})), cb, lb, ub, db, fb = o((() => {
	b(), ye(), R(), De(), q(), Ne(), Le(), mt(), Ey(), qy(), ab(), sb(), cb = new I(), lb = new L(), ub = class e extends y {
		constructor() {
			super(...arguments), this._gpuData = /* @__PURE__ */ Object.create(null), this.autoGarbageCollect = !0, this._gcLastUsed = -1, this.uid = z("graphicsContext"), this.dirty = !0, this.batchMode = "auto", this.instructions = [], this.destroyed = !1, this._activePath = new Ty(), this._transform = new L(), this._fillStyle = { ...e.defaultFillStyle }, this._strokeStyle = { ...e.defaultStrokeStyle }, this._stateStack = [], this._tick = 0, this._bounds = new pt(), this._boundsDirty = !0;
		}
		clone() {
			let t = new e();
			return t.batchMode = this.batchMode, t.instructions = this.instructions.slice(), t._activePath = this._activePath.clone(), t._transform = this._transform.clone(), t._fillStyle = { ...this._fillStyle }, t._strokeStyle = { ...this._strokeStyle }, t._stateStack = this._stateStack.slice(), t._bounds = this._bounds.clone(), t._boundsDirty = !0, t;
		}
		get fillStyle() {
			return this._fillStyle;
		}
		set fillStyle(t) {
			this._fillStyle = rb(t, e.defaultFillStyle);
		}
		get strokeStyle() {
			return this._strokeStyle;
		}
		set strokeStyle(t) {
			this._strokeStyle = ib(t, e.defaultStrokeStyle);
		}
		setFillStyle(t) {
			return this._fillStyle = rb(t, e.defaultFillStyle), this;
		}
		setStrokeStyle(t) {
			return this._strokeStyle = rb(t, e.defaultStrokeStyle), this;
		}
		texture(e, t, n, r, i, a) {
			return this.instructions.push({
				action: "texture",
				data: {
					image: e,
					dx: n || 0,
					dy: r || 0,
					dw: i || e.frame.width,
					dh: a || e.frame.height,
					transform: this._transform.clone(),
					alpha: this._fillStyle.alpha,
					style: t || t === 0 ? F.shared.setValue(t).toNumber() : 16777215
				}
			}), this.onUpdate(), this;
		}
		beginPath() {
			return this._activePath = new Ty(), this;
		}
		fill(t, n) {
			let r, i = this.instructions[this.instructions.length - 1];
			return r = this._tick === 0 && i?.action === "stroke" ? i.data.path : this._activePath.clone(), r ? (t != null && (n !== void 0 && typeof t == "number" && (V(B, "GraphicsContext.fill(color, alpha) is deprecated, use GraphicsContext.fill({ color, alpha }) instead"), t = {
				color: t,
				alpha: n
			}), this._fillStyle = rb(t, e.defaultFillStyle)), this.instructions.push({
				action: "fill",
				data: {
					style: this.fillStyle,
					path: r
				}
			}), this.onUpdate(), this._initNextPathLocation(), this._tick = 0, this) : this;
		}
		_initNextPathLocation() {
			let { x: e, y: t } = this._activePath.getLastPoint(I.shared);
			this._activePath.clear(), this._activePath.moveTo(e, t);
		}
		stroke(t) {
			let n, r = this.instructions[this.instructions.length - 1];
			return n = this._tick === 0 && r?.action === "fill" ? r.data.path : this._activePath.clone(), n ? (t != null && (this._strokeStyle = ib(t, e.defaultStrokeStyle)), this.instructions.push({
				action: "stroke",
				data: {
					style: this.strokeStyle,
					path: n
				}
			}), this.onUpdate(), this._initNextPathLocation(), this._tick = 0, this) : this;
		}
		cut() {
			for (let e = 0; e < 2; e++) {
				let t = this.instructions[this.instructions.length - 1 - e], n = this._activePath.clone();
				if (t && (t.action === "stroke" || t.action === "fill")) if (t.data.hole) t.data.hole.addPath(n);
				else {
					t.data.hole = n;
					break;
				}
			}
			return this._initNextPathLocation(), this;
		}
		arc(e, t, n, r, i, a) {
			this._tick++;
			let o = this._transform;
			return this._activePath.arc(o.a * e + o.c * t + o.tx, o.b * e + o.d * t + o.ty, n, r, i, a), this;
		}
		arcTo(e, t, n, r, i) {
			this._tick++;
			let a = this._transform;
			return this._activePath.arcTo(a.a * e + a.c * t + a.tx, a.b * e + a.d * t + a.ty, a.a * n + a.c * r + a.tx, a.b * n + a.d * r + a.ty, i), this;
		}
		arcToSvg(e, t, n, r, i, a, o) {
			this._tick++;
			let s = this._transform;
			return this._activePath.arcToSvg(e, t, n, r, i, s.a * a + s.c * o + s.tx, s.b * a + s.d * o + s.ty), this;
		}
		bezierCurveTo(e, t, n, r, i, a, o) {
			this._tick++;
			let s = this._transform;
			return this._activePath.bezierCurveTo(s.a * e + s.c * t + s.tx, s.b * e + s.d * t + s.ty, s.a * n + s.c * r + s.tx, s.b * n + s.d * r + s.ty, s.a * i + s.c * a + s.tx, s.b * i + s.d * a + s.ty, o), this;
		}
		closePath() {
			return this._tick++, this._activePath?.closePath(), this;
		}
		ellipse(e, t, n, r) {
			return this._tick++, this._activePath.ellipse(e, t, n, r, this._transform.clone()), this;
		}
		circle(e, t, n) {
			return this._tick++, this._activePath.circle(e, t, n, this._transform.clone()), this;
		}
		path(e) {
			return this._tick++, this._activePath.addPath(e, this._transform.clone()), this;
		}
		lineTo(e, t) {
			this._tick++;
			let n = this._transform;
			return this._activePath.lineTo(n.a * e + n.c * t + n.tx, n.b * e + n.d * t + n.ty), this;
		}
		moveTo(e, t) {
			this._tick++;
			let n = this._transform, r = this._activePath.instructions, i = n.a * e + n.c * t + n.tx, a = n.b * e + n.d * t + n.ty;
			return r.length === 1 && r[0].action === "moveTo" ? (r[0].data[0] = i, r[0].data[1] = a, this) : (this._activePath.moveTo(i, a), this);
		}
		quadraticCurveTo(e, t, n, r, i) {
			this._tick++;
			let a = this._transform;
			return this._activePath.quadraticCurveTo(a.a * e + a.c * t + a.tx, a.b * e + a.d * t + a.ty, a.a * n + a.c * r + a.tx, a.b * n + a.d * r + a.ty, i), this;
		}
		rect(e, t, n, r) {
			return this._tick++, this._activePath.rect(e, t, n, r, this._transform.clone()), this;
		}
		roundRect(e, t, n, r, i) {
			return this._tick++, this._activePath.roundRect(e, t, n, r, i, this._transform.clone()), this;
		}
		poly(e, t) {
			return this._tick++, this._activePath.poly(e, t, this._transform.clone()), this;
		}
		regularPoly(e, t, n, r, i = 0, a) {
			return this._tick++, this._activePath.regularPoly(e, t, n, r, i, a), this;
		}
		roundPoly(e, t, n, r, i, a) {
			return this._tick++, this._activePath.roundPoly(e, t, n, r, i, a), this;
		}
		roundShape(e, t, n, r) {
			return this._tick++, this._activePath.roundShape(e, t, n, r), this;
		}
		filletRect(e, t, n, r, i) {
			return this._tick++, this._activePath.filletRect(e, t, n, r, i), this;
		}
		chamferRect(e, t, n, r, i, a) {
			return this._tick++, this._activePath.chamferRect(e, t, n, r, i, a), this;
		}
		star(e, t, n, r, i = 0, a = 0) {
			return this._tick++, this._activePath.star(e, t, n, r, i, a, this._transform.clone()), this;
		}
		svg(e) {
			return this._tick++, Gy(e, this), this;
		}
		restore() {
			let e = this._stateStack.pop();
			return e && (this._transform = e.transform, this._fillStyle = e.fillStyle, this._strokeStyle = e.strokeStyle), this;
		}
		save() {
			return this._stateStack.push({
				transform: this._transform.clone(),
				fillStyle: { ...this._fillStyle },
				strokeStyle: { ...this._strokeStyle }
			}), this;
		}
		getTransform() {
			return this._transform;
		}
		resetTransform() {
			return this._transform.identity(), this;
		}
		rotate(e) {
			return this._transform.rotate(e), this;
		}
		scale(e, t = e) {
			return this._transform.scale(e, t), this;
		}
		setTransform(e, t, n, r, i, a) {
			return e instanceof L ? (this._transform.set(e.a, e.b, e.c, e.d, e.tx, e.ty), this) : (this._transform.set(e, t, n, r, i, a), this);
		}
		transform(e, t, n, r, i, a) {
			return e instanceof L ? (this._transform.append(e), this) : (lb.set(e, t, n, r, i, a), this._transform.append(lb), this);
		}
		translate(e, t = e) {
			return this._transform.translate(e, t), this;
		}
		clear() {
			return this._activePath.clear(), this.instructions.length = 0, this.resetTransform(), this.onUpdate(), this;
		}
		onUpdate() {
			this._boundsDirty = !0, this.dirty = !0, this.emit("update", this, 16);
		}
		get bounds() {
			if (!this._boundsDirty) return this._bounds;
			this._boundsDirty = !1;
			let e = this._bounds;
			e.clear();
			for (let t = 0; t < this.instructions.length; t++) {
				let n = this.instructions[t], r = n.action;
				if (r === "fill") {
					let t = n.data;
					e.addBounds(t.path.bounds);
				} else if (r === "texture") {
					let t = n.data;
					e.addFrame(t.dx, t.dy, t.dx + t.dw, t.dy + t.dh, t.transform);
				}
				if (r === "stroke") {
					let t = n.data, r = t.style.alignment, i = t.style.width * (1 - r);
					t.style.join === "miter" && (i *= ob(t.path, t.style.miterLimit));
					let a = t.path.bounds;
					e.addFrame(a.minX - i, a.minY - i, a.maxX + i, a.maxY + i);
				}
			}
			return e.isValid || e.set(0, 0, 0, 0), e;
		}
		containsPoint(e) {
			if (!this.bounds.containsPoint(e.x, e.y)) return !1;
			let t = this.instructions, n = !1;
			for (let r = 0; r < t.length; r++) {
				let i = t[r], a = i.data, o = a.path;
				if (!i.action || !o) continue;
				let s = a.style, c = o.shapePath.shapePrimitives;
				for (let t = 0; t < c.length; t++) {
					let r = c[t].shape;
					if (!s || !r) continue;
					let o = c[t].transform, l = o ? o.applyInverse(e, cb) : e;
					if (i.action === "fill") n = r.contains(l.x, l.y);
					else {
						let e = s;
						n = r.strokeContains(l.x, l.y, e.width, e.alignment);
					}
					let u = a.hole;
					if (u) {
						let e = u.shapePath?.shapePrimitives;
						if (e) for (let t = 0; t < e.length; t++) e[t].shape.contains(l.x, l.y) && (n = !1);
					}
					if (n) return !0;
				}
			}
			return n;
		}
		unload() {
			this.emit("unload", this);
			for (let e in this._gpuData) this._gpuData[e]?.destroy();
			this._gpuData = /* @__PURE__ */ Object.create(null);
		}
		destroy(e = !1) {
			if (!this.destroyed) {
				if (this.destroyed = !0, this._stateStack.length = 0, this._transform = null, this.unload(), this.emit("destroy", this), this.removeAllListeners(), typeof e == "boolean" ? e : e?.texture) {
					let t = typeof e == "boolean" ? e : e?.textureSource;
					this._fillStyle.texture && (this._fillStyle.fill && "uid" in this._fillStyle.fill ? this._fillStyle.fill.destroy() : this._fillStyle.texture.destroy(t)), this._strokeStyle.texture && (this._strokeStyle.fill && "uid" in this._strokeStyle.fill ? this._strokeStyle.fill.destroy() : this._strokeStyle.texture.destroy(t));
				}
				this._fillStyle = null, this._strokeStyle = null, this.instructions = null, this._activePath = null, this._bounds = null, this._stateStack = null, this.customShader = null, this._transform = null;
			}
		}
	}, ub.defaultFillStyle = {
		color: 16777215,
		alpha: 1,
		texture: K.WHITE,
		matrix: null,
		fill: null,
		textureSpace: "local"
	}, ub.defaultStrokeStyle = {
		width: 1,
		color: 16777215,
		alpha: 1,
		alignment: .5,
		miterLimit: 10,
		cap: "butt",
		join: "miter",
		texture: K.WHITE,
		matrix: null,
		fill: null,
		textureSpace: "local",
		pixelLine: !1
	}, db = ub;
})), pb, mb, hb, gb, _b = o((() => {
	g(), Yt(), If(), pb = class {
		constructor() {
			this.isBatchable = !1;
		}
		reset() {
			this.isBatchable = !1, this.context = null, this.graphicsData && (this.graphicsData.destroy(), this.graphicsData = null);
		}
		destroy() {
			this.reset();
		}
	}, mb = class {
		constructor() {
			this.instructions = new Jt();
		}
		init() {
			this.instructions.reset();
		}
		destroy() {
			this.instructions.destroy(), this.instructions = null;
		}
	}, hb = class e {
		constructor(e) {
			this._renderer = e, this._managedContexts = new Ff({
				renderer: e,
				type: "resource",
				name: "graphicsContext"
			});
		}
		init(t) {
			e.defaultOptions.bezierSmoothness = t?.bezierSmoothness ?? e.defaultOptions.bezierSmoothness;
		}
		getContextRenderData(e) {
			return this.getGpuContext(e).graphicsData || this._initContextRenderData(e);
		}
		updateGpuContext(e) {
			let t = e._gpuData, n = !!t[this._renderer.uid], r = t[this._renderer.uid] || this._initContext(e);
			return (e.dirty || !n) && (n && r.reset(), r.isBatchable = !1, e.dirty = !1), r;
		}
		getGpuContext(e) {
			return e._gpuData[this._renderer.uid] || this._initContext(e);
		}
		_initContextRenderData(e) {
			let t = new mb(), n = this.getGpuContext(e);
			return n.graphicsData = t, t.init(), t;
		}
		_initContext(e) {
			let t = new pb();
			return t.context = e, e._gpuData[this._renderer.uid] = t, this._managedContexts.add(e), t;
		}
		destroy() {
			this._managedContexts.destroy(), this._renderer = null;
		}
	}, hb.extension = {
		type: [f.CanvasSystem],
		name: "graphicsContext"
	}, hb.defaultOptions = { bezierSmoothness: .5 }, gb = hb;
})), vb, yb = o((() => {
	g(), Vo(), If(), vb = class {
		constructor(e, t) {
			this.state = Bo.for2d(), this.renderer = e, this._adaptor = t, this.renderer.runners.contextChange.add(this), this._managedGraphics = new Ff({
				renderer: e,
				type: "renderable",
				priority: -1,
				name: "graphics"
			});
		}
		contextChange() {
			this._adaptor.contextChange(this.renderer);
		}
		validateRenderable(e) {
			return !1;
		}
		addRenderable(e, t) {
			this._managedGraphics.add(e), this.renderer.renderPipes.batch.break(t), t.add(e);
		}
		updateRenderable(e) {}
		execute(e) {
			e.isRenderable && this._adaptor.execute(this, e);
		}
		destroy() {
			this._managedGraphics.destroy(), this.renderer = null, this._adaptor.destroy(), this._adaptor = null;
		}
	}, vb.extension = {
		type: [f.CanvasPipes],
		name: "graphics"
	};
})), bb, xb, Sb = o((() => {
	g(), Vo(), If(), Ke(), rf(), B_(), bb = class {
		constructor() {
			this.batches = [], this.batched = !1;
		}
		destroy() {
			this.batches.forEach((e) => {
				Ge.return(e);
			}), this.batches.length = 0;
		}
	}, xb = class {
		constructor(e, t) {
			this.state = Bo.for2d(), this.renderer = e, this._adaptor = t, this.renderer.runners.contextChange.add(this), this._managedGraphics = new Ff({
				renderer: e,
				type: "renderable",
				priority: -1,
				name: "graphics"
			});
		}
		contextChange() {
			this._adaptor.contextChange(this.renderer);
		}
		validateRenderable(e) {
			let t = e.context, n = !!e._gpuData, r = this.renderer.graphicsContext.updateGpuContext(t);
			return !!(r.isBatchable || n !== r.isBatchable);
		}
		addRenderable(e, t) {
			let n = this.renderer.graphicsContext.updateGpuContext(e.context);
			e.didViewUpdate && this._rebuild(e), n.isBatchable ? this._addToBatcher(e, t) : (this.renderer.renderPipes.batch.break(t), t.add(e));
		}
		updateRenderable(e) {
			let t = this._getGpuDataForRenderable(e).batches;
			for (let e = 0; e < t.length; e++) {
				let n = t[e];
				n._batcher.updateElement(n);
			}
		}
		execute(e) {
			if (!e.isRenderable) return;
			let t = this.renderer, n = e.context;
			if (!t.graphicsContext.getGpuContext(n).batches.length) return;
			let r = n.customShader || this._adaptor.shader;
			this.state.blendMode = e.groupBlendMode;
			let i = r.resources.localUniforms.uniforms;
			i.uTransformMatrix = e.groupTransform, i.uRound = t._roundPixels | e._roundPixels, nf(e.groupColorAlpha, i.uColor, 0), this._adaptor.execute(this, e);
		}
		_rebuild(e) {
			let t = this._getGpuDataForRenderable(e), n = this.renderer.graphicsContext.updateGpuContext(e.context);
			t.destroy(), n.isBatchable && this._updateBatchesForRenderable(e, t);
		}
		_addToBatcher(e, t) {
			let n = this.renderer.renderPipes.batch, r = this._getGpuDataForRenderable(e).batches;
			for (let e = 0; e < r.length; e++) {
				let i = r[e];
				n.addToBatch(i, t);
			}
		}
		_getGpuDataForRenderable(e) {
			return e._gpuData[this.renderer.uid] || this._initGpuDataForRenderable(e);
		}
		_initGpuDataForRenderable(e) {
			let t = new bb();
			return e._gpuData[this.renderer.uid] = t, this._managedGraphics.add(e), t;
		}
		_updateBatchesForRenderable(e, t) {
			let n = e.context, r = this.renderer.graphicsContext.getGpuContext(n), i = this.renderer._roundPixels | e._roundPixels;
			t.batches = r.batches.map((t) => {
				let n = Ge.get(z_);
				return t.copyTo(n), n.renderable = e, n.roundPixels = i, n;
			});
		}
		destroy() {
			this._managedGraphics.destroy(), this.renderer = null, this._adaptor.destroy(), this._adaptor = null, this.state = null;
		}
	}, xb.extension = {
		type: [f.WebGLPipes, f.WebGPUPipes],
		name: "graphics"
	};
})), Cb = o((() => {
	g(), _b(), yb(), Bv(), Sb(), h.add(vb), h.add(xb), h.add(gb), h.add(zv);
})), wb, Tb = o((() => {
	Le(), Lr(), fb(), Cb(), wb = class e extends Ir {
		constructor(e) {
			e instanceof db && (e = { context: e });
			let { context: t, roundPixels: n, ...r } = e || {};
			super({
				label: "Graphics",
				...r
			}), this.renderPipeId = "graphics", t ? this.context = t : (this.context = this._ownedContext = new db(), this.context.autoGarbageCollect = this.autoGarbageCollect), this.didViewUpdate = !0, this.allowChildren = !1, this.roundPixels = n ?? !1;
		}
		set context(e) {
			e !== this._context && (this._context && (this._context.off("update", this.onViewUpdate, this), this._context.off("unload", this.unload, this)), this._context = e, this._context.on("update", this.onViewUpdate, this), this._context.on("unload", this.unload, this), this.onViewUpdate());
		}
		get context() {
			return this._context;
		}
		get bounds() {
			return this._context.bounds;
		}
		updateBounds() {}
		containsPoint(e) {
			return this._context.containsPoint(e);
		}
		destroy(e) {
			this._ownedContext && !e ? this._ownedContext.destroy(e) : (e === !0 || e?.context === !0) && this._context.destroy(e), this._ownedContext = null, this._context = null, super.destroy(e);
		}
		_onTouch(e) {
			this._gcLastUsed = e, this._context._gcLastUsed = e;
		}
		_callContextMethod(e, t) {
			return this.context[e](...t), this;
		}
		setFillStyle(...e) {
			return this._callContextMethod("setFillStyle", e);
		}
		setStrokeStyle(...e) {
			return this._callContextMethod("setStrokeStyle", e);
		}
		fill(...e) {
			return this._callContextMethod("fill", e);
		}
		stroke(...e) {
			return this._callContextMethod("stroke", e);
		}
		texture(...e) {
			return this._callContextMethod("texture", e);
		}
		beginPath() {
			return this._callContextMethod("beginPath", []);
		}
		cut() {
			return this._callContextMethod("cut", []);
		}
		arc(...e) {
			return this._callContextMethod("arc", e);
		}
		arcTo(...e) {
			return this._callContextMethod("arcTo", e);
		}
		arcToSvg(...e) {
			return this._callContextMethod("arcToSvg", e);
		}
		bezierCurveTo(...e) {
			return this._callContextMethod("bezierCurveTo", e);
		}
		closePath() {
			return this._callContextMethod("closePath", []);
		}
		ellipse(...e) {
			return this._callContextMethod("ellipse", e);
		}
		circle(...e) {
			return this._callContextMethod("circle", e);
		}
		path(...e) {
			return this._callContextMethod("path", e);
		}
		lineTo(...e) {
			return this._callContextMethod("lineTo", e);
		}
		moveTo(...e) {
			return this._callContextMethod("moveTo", e);
		}
		quadraticCurveTo(...e) {
			return this._callContextMethod("quadraticCurveTo", e);
		}
		rect(...e) {
			return this._callContextMethod("rect", e);
		}
		roundRect(...e) {
			return this._callContextMethod("roundRect", e);
		}
		poly(...e) {
			return this._callContextMethod("poly", e);
		}
		regularPoly(...e) {
			return this._callContextMethod("regularPoly", e);
		}
		roundPoly(...e) {
			return this._callContextMethod("roundPoly", e);
		}
		roundShape(...e) {
			return this._callContextMethod("roundShape", e);
		}
		filletRect(...e) {
			return this._callContextMethod("filletRect", e);
		}
		chamferRect(...e) {
			return this._callContextMethod("chamferRect", e);
		}
		star(...e) {
			return this._callContextMethod("star", e);
		}
		svg(...e) {
			return this._callContextMethod("svg", e);
		}
		restore(...e) {
			return this._callContextMethod("restore", e);
		}
		save() {
			return this._callContextMethod("save", []);
		}
		getTransform() {
			return this.context.getTransform();
		}
		resetTransform() {
			return this._callContextMethod("resetTransform", []);
		}
		rotateTransform(...e) {
			return this._callContextMethod("rotate", e);
		}
		scaleTransform(...e) {
			return this._callContextMethod("scale", e);
		}
		setTransform(...e) {
			return this._callContextMethod("setTransform", e);
		}
		transform(...e) {
			return this._callContextMethod("transform", e);
		}
		translateTransform(...e) {
			return this._callContextMethod("translate", e);
		}
		clear() {
			return this._callContextMethod("clear", []);
		}
		get fillStyle() {
			return this._context.fillStyle;
		}
		set fillStyle(e) {
			this._context.fillStyle = e;
		}
		get strokeStyle() {
			return this._context.strokeStyle;
		}
		set strokeStyle(e) {
			this._context.strokeStyle = e;
		}
		clone(t = !1) {
			return t ? new e(this._context.clone()) : (this._ownedContext = null, new e(this._context));
		}
		lineStyle(e, t, n) {
			V(B, "Graphics#lineStyle is no longer needed. Use Graphics#setStrokeStyle to set the stroke style.");
			let r = {};
			return e && (r.width = e), t && (r.color = t), n && (r.alpha = n), this.context.strokeStyle = r, this;
		}
		beginFill(e, t) {
			V(B, "Graphics#beginFill is no longer needed. Use Graphics#fill to fill the shape with the desired style.");
			let n = {};
			return e !== void 0 && (n.color = e), t !== void 0 && (n.alpha = t), this.context.fillStyle = n, this;
		}
		endFill() {
			V(B, "Graphics#endFill is no longer needed. Use Graphics#fill to fill the shape with the desired style."), this.context.fill();
			let e = this.context.strokeStyle;
			return (e.width !== db.defaultStrokeStyle.width || e.color !== db.defaultStrokeStyle.color || e.alpha !== db.defaultStrokeStyle.alpha) && this.context.stroke(), this;
		}
		drawCircle(...e) {
			return V(B, "Graphics#drawCircle has been renamed to Graphics#circle"), this._callContextMethod("circle", e);
		}
		drawEllipse(...e) {
			return V(B, "Graphics#drawEllipse has been renamed to Graphics#ellipse"), this._callContextMethod("ellipse", e);
		}
		drawPolygon(...e) {
			return V(B, "Graphics#drawPolygon has been renamed to Graphics#poly"), this._callContextMethod("poly", e);
		}
		drawRect(...e) {
			return V(B, "Graphics#drawRect has been renamed to Graphics#rect"), this._callContextMethod("rect", e);
		}
		drawRoundedRect(...e) {
			return V(B, "Graphics#drawRoundedRect has been renamed to Graphics#roundRect"), this._callContextMethod("roundRect", e);
		}
		drawStar(...e) {
			return V(B, "Graphics#drawStar has been renamed to Graphics#star"), this._callContextMethod("star", e);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/mask/stencil/CanvasStencilMaskPipe.mjs
function Eb(e, t, n, r, i, a) {
	a = Math.max(0, Math.min(a, Math.min(r, i) / 2)), e.moveTo(t + a, n), e.lineTo(t + r - a, n), e.quadraticCurveTo(t + r, n, t + r, n + a), e.lineTo(t + r, n + i - a), e.quadraticCurveTo(t + r, n + i, t + r - a, n + i), e.lineTo(t + a, n + i), e.quadraticCurveTo(t, n + i, t, n + i - a), e.lineTo(t, n + a), e.quadraticCurveTo(t, n, t + a, n);
}
function Db(e, t) {
	switch (t.type) {
		case "rectangle": {
			let n = t;
			e.rect(n.x, n.y, n.width, n.height);
			break;
		}
		case "roundedRectangle": {
			let n = t;
			Eb(e, n.x, n.y, n.width, n.height, n.radius);
			break;
		}
		case "circle": {
			let n = t;
			e.moveTo(n.x + n.radius, n.y), e.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
			break;
		}
		case "ellipse": {
			let n = t;
			e.ellipse ? (e.moveTo(n.x + n.halfWidth, n.y), e.ellipse(n.x, n.y, n.halfWidth, n.halfHeight, 0, 0, Math.PI * 2)) : (e.save(), e.translate(n.x, n.y), e.scale(n.halfWidth, n.halfHeight), e.moveTo(1, 0), e.arc(0, 0, 1, 0, Math.PI * 2), e.restore());
			break;
		}
		case "triangle": {
			let n = t;
			e.moveTo(n.x, n.y), e.lineTo(n.x2, n.y2), e.lineTo(n.x3, n.y3), e.closePath();
			break;
		}
		default: {
			let n = t, r = n.points;
			if (!r?.length) break;
			e.moveTo(r[0], r[1]);
			for (let t = 2; t < r.length; t += 2) e.lineTo(r[t], r[t + 1]);
			n.closePath && e.closePath();
			break;
		}
	}
}
function Ob(e, t) {
	if (!t?.length) return !1;
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (!r?.shape) continue;
		let i = r.transform, a = i && !i.isIdentity();
		a && (e.save(), e.transform(i.a, i.b, i.c, i.d, i.tx, i.ty)), Db(e, r.shape), a && e.restore();
	}
	return !0;
}
var kb, Ab = o((() => {
	g(), Tb(), U(), kb = class {
		constructor(e) {
			this._warnedMaskTypes = /* @__PURE__ */ new Set(), this._canvasMaskStack = [], this._renderer = e;
		}
		push(e, t, n) {
			this._renderer.renderPipes.batch.break(n), n.add({
				renderPipeId: "stencilMask",
				action: "pushMaskBegin",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
		}
		pop(e, t, n) {
			this._renderer.renderPipes.batch.break(n), n.add({
				renderPipeId: "stencilMask",
				action: "popMaskEnd",
				mask: e,
				inverse: t._maskOptions.inverse,
				canBundle: !1
			});
		}
		execute(e) {
			if (e.action !== "pushMaskBegin" && e.action !== "popMaskEnd") return;
			let t = this._renderer, n = t.canvasContext, r = n?.activeContext;
			if (!r) return;
			if (e.action === "popMaskEnd") {
				this._canvasMaskStack.pop() && r.restore();
				return;
			}
			e.inverse && this._warnOnce("inverse", "CanvasRenderer: inverse masks are not supported on Canvas2D; ignoring inverse flag.");
			let i = e.mask.mask;
			if (!(i instanceof wb)) {
				this._warnOnce("nonGraphics", "CanvasRenderer: only Graphics masks are supported in Canvas2D; skipping mask."), this._canvasMaskStack.push(!1);
				return;
			}
			let a = i, o = a.context?.instructions;
			if (!o?.length) {
				this._canvasMaskStack.push(!1);
				return;
			}
			r.save(), n.setContextTransform(a.groupTransform, (t._roundPixels | a._roundPixels) === 1), r.beginPath();
			let s = !1, c = !1;
			for (let e = 0; e < o.length; e++) {
				let t = o[e], n = t.action;
				if (n !== "fill" && n !== "stroke") continue;
				let i = t.data?.path?.shapePath;
				if (!i?.shapePrimitives?.length) continue;
				let a = i.shapePrimitives;
				for (let e = 0; e < a.length; e++) {
					let t = a[e];
					if (!t?.shape) continue;
					let n = t.transform, i = n && !n.isIdentity();
					i && (r.save(), r.transform(n.a, n.b, n.c, n.d, n.tx, n.ty)), Db(r, t.shape), c = Ob(r, t.holes) || c, s = !0, i && r.restore();
				}
			}
			if (!s) {
				r.restore(), this._canvasMaskStack.push(!1);
				return;
			}
			c ? r.clip("evenodd") : r.clip(), this._canvasMaskStack.push(!0);
		}
		destroy() {
			this._renderer = null, this._warnedMaskTypes = null, this._canvasMaskStack = null;
		}
		_warnOnce(e, t) {
			this._warnedMaskTypes.has(e) || (this._warnedMaskTypes.add(e), H(t));
		}
	}, kb.extension = {
		type: [f.CanvasPipes],
		name: "stencilMask"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/canvas/utils/mapCanvasBlendModesToPixi.mjs
function jb() {
	let e = u_(), t = /* @__PURE__ */ Object.create(null);
	return t.inherit = $, t.none = $, t.normal = "source-over", t.add = "lighter", t.multiply = e ? "multiply" : $, t.screen = e ? "screen" : $, t.overlay = e ? "overlay" : $, t.darken = e ? "darken" : $, t.lighten = e ? "lighten" : $, t["color-dodge"] = e ? "color-dodge" : $, t["color-burn"] = e ? "color-burn" : $, t["hard-light"] = e ? "hard-light" : $, t["soft-light"] = e ? "soft-light" : $, t.difference = e ? "difference" : $, t.exclusion = e ? "exclusion" : $, t.saturation = e ? "saturation" : $, t.color = e ? "color" : $, t.luminosity = e ? "luminosity" : $, t["linear-burn"] = e ? "color-burn" : $, t["linear-dodge"] = e ? "color-dodge" : $, t["linear-light"] = e ? "hard-light" : $, t["pin-light"] = e ? "hard-light" : $, t["vivid-light"] = e ? "hard-light" : $, t["hard-mix"] = $, t.negation = e ? "difference" : $, t["normal-npm"] = t.normal, t["add-npm"] = t.add, t["screen-npm"] = t.screen, t.erase = "destination-out", t.subtract = $, t.divide = $, t.min = $, t.max = $, t;
}
var $, Mb = o((() => {
	f_(), $ = "source-over";
})), Nb, Pb, Fb = o((() => {
	ye(), g(), R(), Mb(), Nb = new L(), Pb = class {
		constructor(e) {
			this.activeResolution = 1, this.smoothProperty = "imageSmoothingEnabled", this.blendModes = jb(), this._activeBlendMode = "normal", this._projTransform = null, this._outerBlend = !1, this._warnedBlendModes = /* @__PURE__ */ new Set(), this._renderer = e;
		}
		resolutionChange(e) {
			this.activeResolution = e;
		}
		init() {
			let e = this._renderer.background.alpha < 1;
			if (this.rootContext = this._renderer.canvas.getContext("2d", { alpha: e }), this.activeContext = this.rootContext, this.activeResolution = this._renderer.resolution, !this.rootContext.imageSmoothingEnabled) {
				let e = this.rootContext;
				e.webkitImageSmoothingEnabled ? this.smoothProperty = "webkitImageSmoothingEnabled" : e.mozImageSmoothingEnabled ? this.smoothProperty = "mozImageSmoothingEnabled" : e.oImageSmoothingEnabled ? this.smoothProperty = "oImageSmoothingEnabled" : e.msImageSmoothingEnabled && (this.smoothProperty = "msImageSmoothingEnabled");
			}
		}
		setContextTransform(e, t, n, r) {
			let i = r ? L.IDENTITY : this._renderer.globalUniforms.globalUniformData?.worldTransformMatrix || L.IDENTITY, a = Nb;
			a.copyFrom(i), a.append(e);
			let o = this._projTransform, s = this.activeResolution;
			if (n = n || s, o) {
				let e = L.shared;
				e.copyFrom(a), e.prepend(o), a = e;
			}
			t ? this.activeContext.setTransform(a.a * n, a.b * n, a.c * n, a.d * n, a.tx * s | 0, a.ty * s | 0) : this.activeContext.setTransform(a.a * n, a.b * n, a.c * n, a.d * n, a.tx * s, a.ty * s);
		}
		clear(e, t) {
			let n = this.activeContext, r = this._renderer;
			if (n.clearRect(0, 0, r.width, r.height), e) {
				let i = F.shared.setValue(e);
				n.globalAlpha = t ?? i.alpha, n.fillStyle = i.toHex(), n.fillRect(0, 0, r.width, r.height), n.globalAlpha = 1;
			}
		}
		setBlendMode(e) {
			if (this._activeBlendMode === e) return;
			this._activeBlendMode = e, this._outerBlend = !1;
			let t = this.blendModes[e];
			if (!t) {
				this._warnedBlendModes.has(e) || (console.warn(`CanvasRenderer: blend mode "${e}" is not supported in Canvas2D; falling back to "source-over".`), this._warnedBlendModes.add(e)), this.activeContext.globalCompositeOperation = "source-over";
				return;
			}
			this.activeContext.globalCompositeOperation = t;
		}
		destroy() {
			this.rootContext = null, this.activeContext = null, this._warnedBlendModes.clear();
		}
	}, Pb.extension = {
		type: [f.CanvasSystem],
		name: "canvasContext"
	};
})), Ib, Lb = o((() => {
	g(), Ib = class {
		constructor() {
			this.maxTextures = 16, this.maxBatchableTextures = 16, this.maxUniformBindings = 0;
		}
		init() {}
	}, Ib.extension = {
		type: [f.CanvasSystem],
		name: "limits"
	};
})), Rb, zb = o((() => {
	ye(), Y(), na(), Rb = class {
		init(e, t) {
			this._renderer = e, this._renderTargetSystem = t;
		}
		initGpuRenderTarget(e) {
			let t = e.colorTexture, { canvas: n, context: r } = this._ensureCanvas(t);
			return {
				canvas: n,
				context: r,
				width: n.width,
				height: n.height
			};
		}
		resizeGpuRenderTarget(e) {
			let t = e.colorTexture, { canvas: n } = this._ensureCanvas(t);
			n.width = e.pixelWidth, n.height = e.pixelHeight;
		}
		startRenderPass(e, t, n, r) {
			let i = this._renderTargetSystem.getGpuRenderTarget(e);
			this._renderer.canvasContext.activeContext = i.context, this._renderer.canvasContext.activeResolution = e.resolution, t && this.clear(e, t, n, r);
		}
		clear(e, t, n, r) {
			let i = this._renderTargetSystem.getGpuRenderTarget(e).context, a = r || {
				x: 0,
				y: 0,
				width: e.pixelWidth,
				height: e.pixelHeight
			};
			if (i.setTransform(1, 0, 0, 1, 0, 0), i.clearRect(a.x, a.y, a.width, a.height), n) {
				let e = F.shared.setValue(n);
				e.alpha > 0 && (i.globalAlpha = e.alpha, i.fillStyle = e.toHex(), i.fillRect(a.x, a.y, a.width, a.height), i.globalAlpha = 1);
			}
		}
		finishRenderPass() {}
		copyToTexture(e, t, n, r, i) {
			let a = this._renderTargetSystem.getGpuRenderTarget(e).canvas, o = t.source, { context: s } = this._ensureCanvas(o), c = i?.x ?? 0, l = i?.y ?? 0;
			return s.drawImage(a, n.x, n.y, r.width, r.height, c, l, r.width, r.height), o.update(), t;
		}
		destroyGpuRenderTarget(e) {}
		_ensureCanvas(e) {
			let t = e.resource;
			(!t || !ta.test(t)) && (t = J.get().createCanvas(e.pixelWidth, e.pixelHeight), e.resource = t), (t.width !== e.pixelWidth || t.height !== e.pixelHeight) && (t.width = e.pixelWidth, t.height = e.pixelHeight);
			let n = t.getContext("2d");
			return {
				canvas: t,
				context: n
			};
		}
	};
})), Bb, Vb = o((() => {
	g(), Lp(), zb(), Bb = class extends Ip {
		constructor(e) {
			super(e), this.adaptor = new Rb(), this.adaptor.init(e, this);
		}
	}, Bb.extension = {
		type: [f.CanvasSystem],
		name: "renderTarget"
	};
})), Hb, Ub = o((() => {
	Y(), g(), p_(), Hb = class {
		constructor(e) {}
		init() {}
		initSource(e) {}
		generateCanvas(e) {
			let t = J.get().createCanvas(), n = t.getContext("2d"), r = Q.getCanvasSource(e);
			if (!r) return t;
			let i = e.frame, a = e.source._resolution ?? e.source.resolution ?? 1, o = i.x * a, s = i.y * a, c = i.width * a, l = i.height * a;
			return t.width = Math.ceil(c), t.height = Math.ceil(l), n.drawImage(r, o, s, c, l, 0, 0, c, l), t;
		}
		getPixels(e) {
			let t = this.generateCanvas(e);
			return {
				pixels: t.getContext("2d", { willReadFrequently: !0 }).getImageData(0, 0, t.width, t.height).data,
				width: t.width,
				height: t.height
			};
		}
		destroy() {}
	}, Hb.extension = {
		type: [f.CanvasSystem],
		name: "texture"
	};
})), Wb = /* @__PURE__ */ c({ CanvasRenderer: () => Zb }), Gb, Kb, qb, Jb, Yb, Xb, Zb, Qb = o((() => {
	g(), eu(), ou(), Ev(), Su(), kv(), gd(), Od(), jv(), Ab(), Rd(), Nc(), Mf(), xo(), Fb(), Lb(), Vb(), Ub(), Gb = [
		...Af,
		Pb,
		Ib,
		Hb,
		Bb
	], Kb = [
		Ld,
		hd,
		xu,
		au,
		Dd,
		kb,
		Av,
		$l
	], qb = [Ov, Tv], Jb = [], Yb = [], Xb = [], h.handleByNamedList(f.CanvasSystem, Jb), h.handleByNamedList(f.CanvasPipes, Yb), h.handleByNamedList(f.CanvasPipesAdaptor, Xb), h.add(...Gb, ...Kb, ...qb), Zb = class extends Mc {
		constructor() {
			let e = {
				name: "canvas",
				type: bo.CANVAS,
				systems: Jb,
				renderPipes: Yb,
				renderPipeAdaptors: Xb
			};
			super(e);
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/rendering/renderers/autoDetectRenderer.mjs
async function $b(e) {
	let t = [];
	e.preference ? (t.push(e.preference), ex.forEach((n) => {
		n !== e.preference && t.push(n);
	})) : t = ex.slice();
	let n, r = {};
	for (let i = 0; i < t.length; i++) {
		let a = t[i];
		if (a === "webgpu" && await Lc()) {
			let { WebGPURenderer: t } = await Promise.resolve().then(() => (Tm(), _m));
			n = t, r = {
				...e,
				...e.webgpu
			};
			break;
		} else if (a === "webgl" && Pc(e.failIfMajorPerformanceCaveat ?? Mc.defaultOptions.failIfMajorPerformanceCaveat)) {
			let { WebGLRenderer: t } = await Promise.resolve().then(() => (c_(), e_));
			n = t, r = {
				...e,
				...e.webgl
			};
			break;
		} else if (a === "canvas") {
			let { CanvasRenderer: t } = await Promise.resolve().then(() => (Qb(), Wb));
			n = t, r = {
				...e,
				...e.canvasOptions
			};
			break;
		}
	}
	if (delete r.webgpu, delete r.webgl, delete r.canvasOptions, !n) throw Error("No available renderer for the current environment");
	let i = new n();
	return await i.init(r), i;
}
var ex, tx = o((() => {
	Ic(), zc(), Nc(), ex = [
		"webgl",
		"webgpu",
		"canvas"
	];
})), nx, rx = o((() => {
	g(), nx = class {
		static init(e) {
			Object.defineProperty(this, "resizeTo", {
				configurable: !0,
				set(e) {
					globalThis.removeEventListener("resize", this.queueResize), this._resizeTo = e, e && (globalThis.addEventListener("resize", this.queueResize), this.resize());
				},
				get() {
					return this._resizeTo;
				}
			}), this.queueResize = () => {
				this._resizeTo && (this._cancelResize(), this._resizeId = requestAnimationFrame(() => this.resize()));
			}, this._cancelResize = () => {
				this._resizeId && (cancelAnimationFrame(this._resizeId), this._resizeId = null);
			}, this.resize = () => {
				if (!this._resizeTo) return;
				this._cancelResize();
				let e, t;
				if (this._resizeTo === globalThis.window) e = globalThis.innerWidth, t = globalThis.innerHeight;
				else {
					let { clientWidth: n, clientHeight: r } = this._resizeTo;
					e = n, t = r;
				}
				this.renderer.resize(e, t), this.render();
			}, this._resizeId = null, this._resizeTo = null, this.resizeTo = e.resizeTo || null;
		}
		static destroy() {
			globalThis.removeEventListener("resize", this.queueResize), this._cancelResize(), this._cancelResize = null, this.queueResize = null, this.resizeTo = null, this.resize = null;
		}
	}, nx.extension = f.Application;
})), ix, ax = o((() => {
	g(), Vn(), Kn(), ix = class {
		static init(e) {
			e = Object.assign({
				autoStart: !0,
				sharedTicker: !1
			}, e), Object.defineProperty(this, "ticker", {
				configurable: !0,
				set(e) {
					this._ticker && this._ticker.remove(this.render, this), this._ticker = e, e && e.add(this.render, this, Bn.LOW);
				},
				get() {
					return this._ticker;
				}
			}), this.stop = () => {
				this._ticker.stop();
			}, this.start = () => {
				this._ticker.start();
			}, this._ticker = null, this.ticker = e.sharedTicker ? Gn.shared : new Gn(), e.autoStart && this.start();
		}
		static destroy() {
			if (this._ticker) {
				let e = this._ticker;
				this.ticker = null, e.destroy();
			}
		}
	}, ix.extension = f.Application;
})), ox = o((() => {
	g(), rx(), ax(), h.add(nx), h.add(ix);
})), sx, cx, lx = o((() => {
	g(), tx(), zn(), Du(), Le(), ox(), sx = class e {
		constructor(...e) {
			this.stage = new Rn(), e[0] !== void 0 && V(B, "Application constructor options are deprecated, please use Application.init() instead.");
		}
		async init(t) {
			t = { ...t }, this.stage || (this.stage = new Rn()), this.renderer = await $b(t), e._plugins.forEach((e) => {
				e.init.call(this, t);
			});
		}
		render() {
			this.renderer.render({ container: this.stage });
		}
		get canvas() {
			return this.renderer.canvas;
		}
		get view() {
			return V(B, "Application.view is deprecated, please use Application.canvas instead."), this.renderer.canvas;
		}
		get screen() {
			return this.renderer.screen;
		}
		destroy(t = !1, n = !1) {
			let r = e._plugins.slice(0);
			r.reverse(), r.forEach((e) => {
				e.destroy.call(this);
			}), this.stage.destroy(n), this.stage = null, this.renderer.destroy(t), this.renderer = null;
		}
	}, sx._plugins = [], cx = sx, h.handleByList(f.Application, cx._plugins), h.add(Tu);
}));
//#endregion
//#region node_modules/tiny-lru/dist/tiny-lru.js
function ux(e = 1e3, t = 0, n = !1) {
	if (isNaN(e) || e < 0) throw TypeError("Invalid max value");
	if (isNaN(t) || t < 0) throw TypeError("Invalid ttl value");
	if (typeof n != "boolean") throw TypeError("Invalid resetTtl value");
	return new dx(e, t, n);
}
var dx, fx = o((() => {
	dx = class {
		constructor(e = 0, t = 0, n = !1) {
			this.first = null, this.items = Object.create(null), this.last = null, this.max = e, this.resetTtl = n, this.size = 0, this.ttl = t;
		}
		clear() {
			return this.first = null, this.items = Object.create(null), this.last = null, this.size = 0, this;
		}
		delete(e) {
			if (this.has(e)) {
				let t = this.items[e];
				delete this.items[e], this.size--, t.prev !== null && (t.prev.next = t.next), t.next !== null && (t.next.prev = t.prev), this.first === t && (this.first = t.next), this.last === t && (this.last = t.prev);
			}
			return this;
		}
		entries(e = this.keys()) {
			let t = Array(e.length);
			for (let n = 0; n < e.length; n++) {
				let r = e[n];
				t[n] = [r, this.get(r)];
			}
			return t;
		}
		evict(e = !1) {
			if (e || this.size > 0) {
				let e = this.first;
				delete this.items[e.key], --this.size === 0 ? (this.first = null, this.last = null) : (this.first = e.next, this.first.prev = null);
			}
			return this;
		}
		expiresAt(e) {
			let t;
			return this.has(e) && (t = this.items[e].expiry), t;
		}
		get(e) {
			let t = this.items[e];
			if (t !== void 0) {
				if (this.ttl > 0 && t.expiry <= Date.now()) {
					this.delete(e);
					return;
				}
				return this.moveToEnd(t), t.value;
			}
		}
		has(e) {
			return e in this.items;
		}
		moveToEnd(e) {
			this.last !== e && (e.prev !== null && (e.prev.next = e.next), e.next !== null && (e.next.prev = e.prev), this.first === e && (this.first = e.next), e.prev = this.last, e.next = null, this.last !== null && (this.last.next = e), this.last = e, this.first === null && (this.first = e));
		}
		keys() {
			let e = Array(this.size), t = this.first, n = 0;
			for (; t !== null;) e[n++] = t.key, t = t.next;
			return e;
		}
		setWithEvicted(e, t, n = this.resetTtl) {
			let r = null;
			if (this.has(e)) this.set(e, t, !0, n);
			else {
				this.max > 0 && this.size === this.max && (r = { ...this.first }, this.evict(!0));
				let n = this.items[e] = {
					expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
					key: e,
					prev: this.last,
					next: null,
					value: t
				};
				++this.size === 1 ? this.first = n : this.last.next = n, this.last = n;
			}
			return r;
		}
		set(e, t, n = !1, r = this.resetTtl) {
			let i = this.items[e];
			return n || i !== void 0 ? (i.value = t, n === !1 && r && (i.expiry = this.ttl > 0 ? Date.now() + this.ttl : this.ttl), this.moveToEnd(i)) : (this.max > 0 && this.size === this.max && this.evict(!0), i = this.items[e] = {
				expiry: this.ttl > 0 ? Date.now() + this.ttl : this.ttl,
				key: e,
				prev: this.last,
				next: null,
				value: t
			}, ++this.size === 1 ? this.first = i : this.last.next = i, this.last = i), this;
		}
		values(e = this.keys()) {
			let t = Array(e.length);
			for (let n = 0; n < e.length; n++) t[n] = this.get(e[n]);
			return t;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/parseTaggedText.mjs
function px(e) {
	return !!e.tagStyles && Object.keys(e.tagStyles).length > 0;
}
function mx(e) {
	return e.includes("<");
}
function hx(e, t) {
	return e.clone().assign(t);
}
function gx(e, t) {
	let n = [], r = t.tagStyles;
	if (!px(t) || !mx(e)) return n.push({
		text: e,
		style: t
	}), n;
	let i = [t], a = [], o = "", s = 0;
	for (; s < e.length;) {
		let t = e[s];
		if (t === "<") {
			let c = e.indexOf(">", s);
			if (c === -1) {
				o += t, s++;
				continue;
			}
			let l = e.slice(s + 1, c);
			if (l.startsWith("/")) {
				let t = l.slice(1).trim();
				if (a.length > 0 && a[a.length - 1] === t) {
					o.length > 0 && (n.push({
						text: o,
						style: i[i.length - 1]
					}), o = ""), i.pop(), a.pop(), s = c + 1;
					continue;
				} else {
					o += e.slice(s, c + 1), s = c + 1;
					continue;
				}
			} else {
				let t = l.trim();
				if (r[t]) {
					o.length > 0 && (n.push({
						text: o,
						style: i[i.length - 1]
					}), o = "");
					let e = i[i.length - 1], l = hx(e, r[t]);
					i.push(l), a.push(t), s = c + 1;
					continue;
				} else {
					o += e.slice(s, c + 1), s = c + 1;
					continue;
				}
			}
		} else o += t, s++;
	}
	return o.length > 0 && n.push({
		text: o,
		style: i[i.length - 1]
	}), n;
}
var _x = o((() => {}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/textTokenization.mjs
function vx(e) {
	return typeof e == "string" ? Dx.has(e.charCodeAt(0)) : !1;
}
function yx(e, t) {
	return typeof e == "string" ? kx.has(e.charCodeAt(0)) : !1;
}
function bx(e) {
	return typeof e == "string" ? Mx.has(e.charCodeAt(0)) : !1;
}
function xx(e) {
	return e === "normal" || e === "pre-line";
}
function Sx(e) {
	return e === "normal";
}
function Cx(e) {
	if (typeof e != "string") return "";
	let t = e.length - 1;
	for (; t >= 0 && yx(e[t]);) t--;
	return t < e.length - 1 ? e.slice(0, t + 1) : e;
}
function wx(e) {
	let t = [], n = [];
	if (typeof e != "string") return t;
	for (let r = 0; r < e.length; r++) {
		let i = e[r], a = e[r + 1];
		if (yx(i, a) || vx(i)) {
			n.length > 0 && (t.push(n.join("")), n.length = 0), i === "\r" && a === "\n" ? (t.push("\r\n"), r++) : t.push(i);
			continue;
		}
		n.push(i), bx(i) && a && !yx(a) && !vx(a) && (t.push(n.join("")), n.length = 0);
	}
	return n.length > 0 && t.push(n.join("")), t;
}
function Tx(e, t, n, r) {
	let i = n(e), a = [];
	for (let n = 0; n < i.length; n++) {
		let o = i[n], s = o, c = 1;
		for (; i[n + c];) {
			let a = i[n + c];
			if (!r(s, a, e, n, t)) o += a, s = a, c++;
			else break;
		}
		n += c - 1, a.push(o);
	}
	return a;
}
var Ex, Dx, Ox, kx, Ax, jx, Mx, Nx, Px, Fx = o((() => {
	Ex = [10, 13], Dx = new Set(Ex), Ox = [
		9,
		32,
		8192,
		8193,
		8194,
		8195,
		8196,
		8197,
		8198,
		8200,
		8201,
		8202,
		8287,
		12288
	], kx = new Set(Ox), Ax = [9, 32], new Set(Ax), jx = [
		45,
		8208,
		8211,
		8212,
		173
	], Mx = new Set(jx), Nx = /(\r\n|\r|\n)/, Px = /(?:\r\n|\r|\n)/;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/measureTaggedText.mjs
function Ix(e, t, n, r, i, a, o, s) {
	let c = gx(e, t);
	if (Sx(t.whiteSpace)) for (let e = 0; e < c.length; e++) {
		let t = c[e];
		c[e] = {
			text: t.text.replace(zx, " "),
			style: t.style
		};
	}
	let l = [], u = [];
	for (let e of c) {
		let t = e.text.split(Nx);
		for (let n = 0; n < t.length; n++) {
			let r = t[n];
			r === "\r\n" || r === "\r" || r === "\n" ? (l.push(u), u = []) : r.length > 0 && u.push({
				text: r,
				style: e.style
			});
		}
	}
	(u.length > 0 || l.length === 0) && l.push(u);
	let d = n ? Lx(l, t, r, i, o, s) : l, f = [], p = [], m = [], h = [], g = [], _ = 0, v = t._fontString, y = a(v);
	y.fontSize === 0 && (y.fontSize = t.fontSize, y.ascent = t.fontSize);
	let b = "", x = !!t.dropShadow, S = t._stroke?.width || 0;
	for (let e of d) {
		let n = 0, o = y.ascent, s = y.descent, c = "";
		for (let t of e) {
			let e = t.style._fontString, l = a(e);
			e !== b && (r.font = e, b = e);
			let u = i(t.text, t.style.letterSpacing, r);
			n += u, o = Math.max(o, l.ascent), s = Math.max(s, l.descent), c += t.text;
			let d = t.style._stroke?.width || 0;
			d > S && (S = d), !x && t.style.dropShadow && (x = !0);
		}
		e.length === 0 && (o = y.ascent, s = y.descent), f.push(n), p.push(o), m.push(s), g.push(c);
		let l = t.lineHeight || o + s;
		h.push(l + t.leading), _ = Math.max(_, n);
	}
	let C = S, w = (n && t.align !== "left" ? Math.max(_, t.wordWrapWidth) : _) + C + (t.dropShadow ? t.dropShadow.distance : 0), T = 0;
	for (let e = 0; e < h.length; e++) T += h[e];
	return T = Math.max(T, h[0] + C), {
		width: w,
		height: T + (t.dropShadow ? t.dropShadow.distance : 0),
		lines: g,
		lineWidths: f,
		lineHeight: (t.lineHeight || y.fontSize) + t.leading,
		maxLineWidth: _,
		fontProperties: y,
		runsByLine: d,
		lineAscents: p,
		lineDescents: m,
		lineHeights: h,
		hasDropShadow: x
	};
}
function Lx(e, t, n, r, i, a) {
	let { letterSpacing: o, whiteSpace: s, wordWrapWidth: c, breakWords: l } = t, u = xx(s), d = c + o, f = {}, p = "", m = (e, t) => {
		let i = `${e}|${t.styleKey}`, a = f[i];
		if (a === void 0) {
			let o = t._fontString;
			o !== p && (n.font = o, p = o), a = r(e, t.letterSpacing, n) + t.letterSpacing, f[i] = a;
		}
		return a;
	}, h = [];
	for (let t of e) {
		let e = Rx(t), n = h.length, r = (t) => {
			let n = 0, r = t;
			do {
				let { token: t, style: i } = e[r];
				n += m(t, i), r++;
			} while (r < e.length && e[r].continuesFromPrevious);
			return n;
		}, o = (t) => {
			let n = [], r = t;
			do
				n.push({
					token: e[r].token,
					style: e[r].style
				}), r++;
			while (r < e.length && e[r].continuesFromPrevious);
			return n;
		}, s = [], c = 0, f = !u, p = null, g = () => {
			p && p.text.length > 0 && s.push(p), p = null;
		}, _ = () => {
			if (g(), s.length > 0) {
				let e = s[s.length - 1];
				e.text = Cx(e.text), e.text.length === 0 && s.pop();
			}
			h.push(s), s = [], c = 0, f = !1;
		};
		for (let t = 0; t < e.length; t++) {
			let { token: n, style: v, continuesFromPrevious: y } = e[t], b = m(n, v);
			if (u) {
				let e = yx(n), t = p?.text[p.text.length - 1] ?? s[s.length - 1]?.text.slice(-1) ?? "", r = t ? yx(t) : !1;
				if (e && r) continue;
			}
			let x = !y, S = x ? r(t) : b;
			if (S > d && x) if (c > 0 && _(), l) {
				let e = o(t);
				for (let t = 0; t < e.length; t++) {
					let n = e[t].token, r = e[t].style, o = Tx(n, l, a, i);
					for (let e of o) {
						let t = m(e, r);
						t + c > d && _(), !p || p.style !== r ? (g(), p = {
							text: e,
							style: r
						}) : p.text += e, c += t;
					}
				}
				t += e.length - 1;
			} else {
				let e = o(t);
				g(), h.push(e.map((e) => ({
					text: e.token,
					style: e.style
				}))), f = !1, t += e.length - 1;
			}
			else if (S + c > d && x) {
				if (yx(n)) {
					f = !1;
					continue;
				}
				_(), p = {
					text: n,
					style: v
				}, c = b;
			} else if (y && !l) !p || p.style !== v ? (g(), p = {
				text: n,
				style: v
			}) : p.text += n, c += b;
			else {
				let e = yx(n);
				if (c === 0 && e && !f) continue;
				!p || p.style !== v ? (g(), p = {
					text: n,
					style: v
				}) : p.text += n, c += b;
			}
		}
		if (g(), s.length > 0) {
			let e = s[s.length - 1];
			e.text = Cx(e.text), e.text.length === 0 && s.pop();
		}
		(s.length > 0 || h.length === n) && h.push(s);
	}
	return h;
}
function Rx(e) {
	let t = [], n = !1;
	for (let r of e) {
		let e = wx(r.text), i = !0;
		for (let a of e) {
			let e = yx(a) || vx(a), o = i && n && !e;
			t.push({
				token: a,
				style: r.style,
				continuesFromPrevious: o
			}), n = !e, i = !1;
		}
	}
	return t;
}
var zx, Bx = o((() => {
	_x(), Fx(), zx = /\r\n|\r|\n/g;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/wordWrap.mjs
function Vx(e, t, n, r, i) {
	let a = n[e];
	return typeof a != "number" && (a = i(e, t, r) + t, n[e] = a), a;
}
function Hx(e, t, n, r, i, a, o) {
	let s = n.getContext("2d", Ux);
	s.font = t._fontString;
	let c = 0, l = "", u = [], d = /* @__PURE__ */ Object.create(null), { letterSpacing: f, whiteSpace: p } = t, m = xx(p), h = Sx(p), g = !m, _ = t.wordWrapWidth + f, v = wx(e);
	for (let e = 0; e < v.length; e++) {
		let n = v[e];
		if (vx(n)) {
			if (!h) {
				u.push(Cx(l)), g = !m, l = "", c = 0;
				continue;
			}
			n = " ";
		}
		if (m) {
			let e = yx(n), t = yx(l[l.length - 1]);
			if (e && t) continue;
		}
		let p = Vx(n, f, d, s, r);
		if (p > _) if (l !== "" && (u.push(Cx(l)), l = "", c = 0), i(n, t.breakWords)) {
			let e = Tx(n, t.breakWords, o, a);
			for (let t of e) {
				let e = Vx(t, f, d, s, r);
				e + c > _ && (u.push(Cx(l)), g = !1, l = "", c = 0), l += t, c += e;
			}
		} else l.length > 0 && (u.push(Cx(l)), l = "", c = 0), u.push(Cx(n)), g = !1, l = "", c = 0;
		else p + c > _ && (g = !1, u.push(Cx(l)), l = "", c = 0), (l.length > 0 || !yx(n) || g) && (l += n, c += p);
	}
	let y = Cx(l);
	return y.length > 0 && u.push(y), u.join("\n");
}
var Ux, Wx = o((() => {
	Fx(), Ux = { willReadFrequently: !0 };
})), Gx, Kx, qx, Jx = o((() => {
	fx(), Y(), Bx(), _x(), Fx(), Wx(), Gx = { willReadFrequently: !0 }, Kx = class e {
		static get experimentalLetterSpacingSupported() {
			let t = e._experimentalLetterSpacingSupported;
			if (t === void 0) {
				let n = J.get().getCanvasRenderingContext2D().prototype;
				t = e._experimentalLetterSpacingSupported = "letterSpacing" in n || "textLetterSpacing" in n;
			}
			return t;
		}
		constructor(e, t, n, r, i, a, o, s, c, l) {
			this.text = e, this.style = t, this.width = n, this.height = r, this.lines = i, this.lineWidths = a, this.lineHeight = o, this.maxLineWidth = s, this.fontProperties = c, l && (this.runsByLine = l.runsByLine, this.lineAscents = l.lineAscents, this.lineDescents = l.lineDescents, this.lineHeights = l.lineHeights, this.hasDropShadow = l.hasDropShadow);
		}
		static measureText(t = " ", n, r = e._canvas, i = n.wordWrap) {
			let a = `${t}-${n.styleKey}-wordWrap-${i}`;
			if (e._measurementCache.has(a)) return e._measurementCache.get(a);
			if (px(n) && mx(t)) {
				let r = Ix(t, n, i, e._context, e._measureText, e.measureFont, e.canBreakChars, e.wordWrapSplit), o = new e(t, n, r.width, r.height, r.lines, r.lineWidths, r.lineHeight, r.maxLineWidth, r.fontProperties, {
					runsByLine: r.runsByLine,
					lineAscents: r.lineAscents,
					lineDescents: r.lineDescents,
					lineHeights: r.lineHeights,
					hasDropShadow: r.hasDropShadow
				});
				return e._measurementCache.set(a, o), o;
			}
			let o = n._fontString, s = e.measureFont(o);
			s.fontSize === 0 && (s.fontSize = n.fontSize, s.ascent = n.fontSize, s.descent = 0);
			let c = e._context;
			c.font = o;
			let l = (i ? e._wordWrap(t, n, r) : t).split(Px), u = Array(l.length), d = 0;
			for (let t = 0; t < l.length; t++) {
				let r = e._measureText(l[t], n.letterSpacing, c);
				u[t] = r, d = Math.max(d, r);
			}
			let f = n._stroke?.width ?? 0, p = n.lineHeight || s.fontSize, m = e._getAlignWidth(d, n, i), h = e._adjustWidthForStyle(m, n), g = Math.max(p, s.fontSize + f) + (l.length - 1) * (p + n.leading), _ = new e(t, n, h, e._adjustHeightForStyle(g, n), l, u, p + n.leading, d, s);
			return e._measurementCache.set(a, _), _;
		}
		static _adjustWidthForStyle(e, t) {
			let n = e + (t._stroke?.width || 0);
			return t.dropShadow && (n += t.dropShadow.distance), n;
		}
		static _adjustHeightForStyle(e, t) {
			let n = e;
			return t.dropShadow && (n += t.dropShadow.distance), n;
		}
		static _getAlignWidth(e, t, n) {
			return n && t.align !== "left" ? Math.max(e, t.wordWrapWidth) : e;
		}
		static _measureText(t, n, r) {
			let i = !1;
			e.experimentalLetterSpacingSupported && (e.experimentalLetterSpacing ? (r.letterSpacing = `${n}px`, r.textLetterSpacing = `${n}px`, i = !0) : (r.letterSpacing = "0px", r.textLetterSpacing = "0px"));
			let a = r.measureText(t), o = a.width, s = -(a.actualBoundingBoxLeft ?? 0), c = (a.actualBoundingBoxRight ?? 0) - s;
			if (o > 0) if (i) o -= n, c -= n;
			else {
				let r = (e.graphemeSegmenter(t).length - 1) * n;
				o += r, c += r;
			}
			return Math.max(o, c);
		}
		static _wordWrap(t, n, r = e._canvas) {
			return Hx(t, n, r, e._measureText, e.canBreakWords, e.canBreakChars, e.wordWrapSplit);
		}
		static isBreakingSpace(e, t) {
			return yx(e, t);
		}
		static canBreakWords(e, t) {
			return t;
		}
		static canBreakChars(e, t, n, r, i) {
			return !0;
		}
		static wordWrapSplit(t) {
			return e.graphemeSegmenter(t);
		}
		static measureFont(t) {
			if (e._fonts[t]) return e._fonts[t];
			let n = e._context;
			n.font = t;
			let r = n.measureText(e.METRICS_STRING + e.BASELINE_SYMBOL), i = r.actualBoundingBoxAscent ?? 0, a = r.actualBoundingBoxDescent ?? 0, o = {
				ascent: i,
				descent: a,
				fontSize: i + a
			};
			return e._fonts[t] = o, o;
		}
		static clearMetrics(t = "") {
			t ? delete e._fonts[t] : e._fonts = {};
		}
		static get _canvas() {
			if (!e.__canvas) {
				let t;
				try {
					let n = new OffscreenCanvas(0, 0);
					if (n.getContext("2d", Gx)?.measureText) return e.__canvas = n, n;
					t = J.get().createCanvas();
				} catch {
					t = J.get().createCanvas();
				}
				t.width = t.height = 10, e.__canvas = t;
			}
			return e.__canvas;
		}
		static get _context() {
			return e.__context || (e.__context = e._canvas.getContext("2d", Gx)), e.__context;
		}
	}, Kx.METRICS_STRING = "|ÉqÅ", Kx.BASELINE_SYMBOL = "M", Kx.BASELINE_MULTIPLIER = 1.4, Kx.HEIGHT_MULTIPLIER = 2, Kx.graphemeSegmenter = (() => {
		if (typeof Intl?.Segmenter == "function") {
			let e = new Intl.Segmenter();
			return (t) => {
				let n = e.segment(t), r = [], i = 0;
				for (let e of n) r[i++] = e.segment;
				return r;
			};
		}
		return (e) => [...e];
	})(), Kx.experimentalLetterSpacing = !1, Kx._fonts = {}, Kx._measurementCache = ux(1e3), qx = Kx;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/fontStringFromTextStyle.mjs
function Yx(e) {
	let t = typeof e.fontSize == "number" ? `${e.fontSize}px` : e.fontSize, n = e.fontFamily;
	Array.isArray(e.fontFamily) || (n = e.fontFamily.split(","));
	for (let e = n.length - 1; e >= 0; e--) {
		let t = n[e].trim();
		!/([\"\'])[^\'\"]+\1/.test(t) && !Xx.includes(t) && (t = `"${t}"`), n[e] = t;
	}
	return `${e.fontStyle} ${e.fontVariant} ${e.fontWeight} ${t} ${n.join(",")}`;
}
var Xx, Zx = o((() => {
	Xx = [
		"serif",
		"sans-serif",
		"monospace",
		"cursive",
		"fantasy",
		"system-ui"
	];
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/TextStyle.mjs
function Qx(e) {
	let t = e;
	if (typeof t.dropShadow == "boolean" && t.dropShadow) {
		let n = eS.defaultDropShadow;
		e.dropShadow = {
			alpha: t.dropShadowAlpha ?? n.alpha,
			angle: t.dropShadowAngle ?? n.angle,
			blur: t.dropShadowBlur ?? n.blur,
			color: t.dropShadowColor ?? n.color,
			distance: t.dropShadowDistance ?? n.distance
		};
	}
	if (t.strokeThickness !== void 0) {
		V(B, "strokeThickness is now a part of stroke");
		let n = t.stroke, r = {};
		if (F.isColorLike(n)) r.color = n;
		else if (n instanceof O_ || n instanceof j_) r.fill = n;
		else if (Object.hasOwnProperty.call(n, "color") || Object.hasOwnProperty.call(n, "fill")) r = n;
		else throw Error("Invalid stroke value.");
		e.stroke = {
			...r,
			width: t.strokeThickness
		};
	}
	if (Array.isArray(t.fillGradientStops)) {
		if (V(B, "gradient fill is now a fill pattern: `new FillGradient(...)`"), !Array.isArray(t.fill) || t.fill.length === 0) throw Error("Invalid fill value. Expected an array of colors for gradient fill.");
		t.fill.length !== t.fillGradientStops.length && H("The number of fill colors must match the number of fill gradient stops.");
		let n = new O_({
			start: {
				x: 0,
				y: 0
			},
			end: {
				x: 0,
				y: 1
			},
			textureSpace: "local"
		}), r = t.fillGradientStops.slice(), i = t.fill.map((e) => F.shared.setValue(e).toNumber());
		r.forEach((e, t) => {
			n.addColorStop(e, i[t]);
		}), e.fill = { fill: n };
	}
}
var $x, eS, tS = o((() => {
	b(), ye(), Ne(), Le(), U(), k_(), M_(), fb(), ab(), Zx(), $x = class e extends y {
		constructor(t = {}) {
			super(), this.uid = z("textStyle"), this._tick = 0, this._cachedFontString = null, Qx(t), t instanceof e && (t = t._toObject());
			let n = {
				...e.defaultTextStyle,
				...t
			};
			for (let e in n) {
				let t = e;
				this[t] = n[e];
			}
			this._tagStyles = t.tagStyles ?? void 0, this.update(), this._tick = 0;
		}
		get align() {
			return this._align;
		}
		set align(e) {
			this._align !== e && (this._align = e, this.update());
		}
		get breakWords() {
			return this._breakWords;
		}
		set breakWords(e) {
			this._breakWords !== e && (this._breakWords = e, this.update());
		}
		get dropShadow() {
			return this._dropShadow;
		}
		set dropShadow(t) {
			this._dropShadow !== t && (typeof t == "object" && t ? this._dropShadow = this._createProxy({
				...e.defaultDropShadow,
				...t
			}) : this._dropShadow = t ? this._createProxy({ ...e.defaultDropShadow }) : null, this.update());
		}
		get fontFamily() {
			return this._fontFamily;
		}
		set fontFamily(e) {
			this._fontFamily !== e && (this._fontFamily = e, this.update());
		}
		get fontSize() {
			return this._fontSize;
		}
		set fontSize(e) {
			this._fontSize !== e && (typeof e == "string" ? this._fontSize = parseInt(e, 10) : this._fontSize = e, this.update());
		}
		get fontStyle() {
			return this._fontStyle;
		}
		set fontStyle(e) {
			this._fontStyle !== e && (this._fontStyle = e.toLowerCase(), this.update());
		}
		get fontVariant() {
			return this._fontVariant;
		}
		set fontVariant(e) {
			this._fontVariant !== e && (this._fontVariant = e, this.update());
		}
		get fontWeight() {
			return this._fontWeight;
		}
		set fontWeight(e) {
			this._fontWeight !== e && (this._fontWeight = e, this.update());
		}
		get leading() {
			return this._leading;
		}
		set leading(e) {
			this._leading !== e && (this._leading = e, this.update());
		}
		get letterSpacing() {
			return this._letterSpacing;
		}
		set letterSpacing(e) {
			this._letterSpacing !== e && (this._letterSpacing = e, this.update());
		}
		get lineHeight() {
			return this._lineHeight;
		}
		set lineHeight(e) {
			this._lineHeight !== e && (this._lineHeight = e, this.update());
		}
		get padding() {
			return this._padding;
		}
		set padding(e) {
			this._padding !== e && (this._padding = e, this.update());
		}
		get filters() {
			return this._filters;
		}
		set filters(e) {
			this._filters !== e && (this._filters = Object.freeze(e), this.update());
		}
		get trim() {
			return this._trim;
		}
		set trim(e) {
			this._trim !== e && (this._trim = e, this.update());
		}
		get textBaseline() {
			return this._textBaseline;
		}
		set textBaseline(e) {
			this._textBaseline !== e && (this._textBaseline = e, this.update());
		}
		get whiteSpace() {
			return this._whiteSpace;
		}
		set whiteSpace(e) {
			this._whiteSpace !== e && (this._whiteSpace = e, this.update());
		}
		get wordWrap() {
			return this._wordWrap;
		}
		set wordWrap(e) {
			this._wordWrap !== e && (this._wordWrap = e, this.update());
		}
		get wordWrapWidth() {
			return this._wordWrapWidth;
		}
		set wordWrapWidth(e) {
			this._wordWrapWidth !== e && (this._wordWrapWidth = e, this.update());
		}
		get fill() {
			return this._originalFill;
		}
		set fill(e) {
			e !== this._originalFill && (this._originalFill = e, this._isFillStyle(e) && (this._originalFill = this._createProxy({
				...db.defaultFillStyle,
				...e
			}, () => {
				this._fill = rb({ ...this._originalFill }, db.defaultFillStyle);
			})), this._fill = rb(e === 0 ? "black" : e, db.defaultFillStyle), this.update());
		}
		get stroke() {
			return this._originalStroke;
		}
		set stroke(e) {
			e !== this._originalStroke && (this._originalStroke = e, this._isFillStyle(e) && (this._originalStroke = this._createProxy({
				...db.defaultStrokeStyle,
				...e
			}, () => {
				this._stroke = ib({ ...this._originalStroke }, db.defaultStrokeStyle);
			})), this._stroke = ib(e, db.defaultStrokeStyle), this.update());
		}
		get tagStyles() {
			return this._tagStyles;
		}
		set tagStyles(e) {
			this._tagStyles !== e && (this._tagStyles = e ?? void 0, this.update());
		}
		update() {
			this._tick++, this._cachedFontString = null, this.emit("update", this);
		}
		reset() {
			let t = e.defaultTextStyle;
			for (let e in t) this[e] = t[e];
		}
		assign(e) {
			for (let t in e) {
				let n = t;
				this[n] = e[t];
			}
			return this;
		}
		get styleKey() {
			return `${this.uid}-${this._tick}`;
		}
		get _fontString() {
			return this._cachedFontString === null && (this._cachedFontString = Yx(this)), this._cachedFontString;
		}
		_toObject() {
			return {
				align: this.align,
				breakWords: this.breakWords,
				dropShadow: this._dropShadow ? { ...this._dropShadow } : null,
				fill: this._fill ? { ...this._fill } : void 0,
				fontFamily: this.fontFamily,
				fontSize: this.fontSize,
				fontStyle: this.fontStyle,
				fontVariant: this.fontVariant,
				fontWeight: this.fontWeight,
				leading: this.leading,
				letterSpacing: this.letterSpacing,
				lineHeight: this.lineHeight,
				padding: this.padding,
				stroke: this._stroke ? { ...this._stroke } : void 0,
				textBaseline: this.textBaseline,
				trim: this.trim,
				whiteSpace: this.whiteSpace,
				wordWrap: this.wordWrap,
				wordWrapWidth: this.wordWrapWidth,
				filters: this._filters ? [...this._filters] : void 0,
				tagStyles: this._tagStyles ? { ...this._tagStyles } : void 0
			};
		}
		clone() {
			return new e(this._toObject());
		}
		_getFinalPadding() {
			let e = 0;
			if (this._filters) for (let t = 0; t < this._filters.length; t++) e += this._filters[t].padding;
			return Math.max(this._padding, e);
		}
		destroy(e = !1) {
			if (this.removeAllListeners(), typeof e == "boolean" ? e : e?.texture) {
				let t = typeof e == "boolean" ? e : e?.textureSource;
				this._fill?.texture && this._fill.texture.destroy(t), this._originalFill?.texture && this._originalFill.texture.destroy(t), this._stroke?.texture && this._stroke.texture.destroy(t), this._originalStroke?.texture && this._originalStroke.texture.destroy(t);
			}
			this._fill = null, this._stroke = null, this.dropShadow = null, this._originalStroke = null, this._originalFill = null;
		}
		_createProxy(e, t) {
			return new Proxy(e, { set: (e, n, r) => e[n] === r ? !0 : (e[n] = r, t?.(n, r), this.update(), !0) });
		}
		_isFillStyle(e) {
			return (e ?? null) !== null && !(F.isColorLike(e) || e instanceof O_ || e instanceof j_);
		}
	}, $x.defaultDropShadow = {
		alpha: 1,
		angle: Math.PI / 6,
		blur: 0,
		color: "black",
		distance: 5
	}, $x.defaultTextStyle = {
		align: "left",
		breakWords: !1,
		dropShadow: null,
		fill: "black",
		fontFamily: "Arial",
		fontSize: 26,
		fontStyle: "normal",
		fontVariant: "normal",
		fontWeight: "normal",
		leading: 0,
		letterSpacing: 0,
		lineHeight: 0,
		padding: 0,
		stroke: null,
		textBaseline: "alphabetic",
		trim: !1,
		whiteSpace: "pre",
		wordWrap: !1,
		wordWrapWidth: 100
	}, eS = $x;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/utils/getCanvasFillStyle.mjs
function nS(e, t, n, r = 0, i = 0, a = 0) {
	if (e.texture === K.WHITE && !e.fill) return F.shared.setValue(e.color).setAlpha(e.alpha ?? 1).toHexa();
	if (!e.fill) {
		let n = t.createPattern(e.texture.source.resource, "repeat"), r = e.matrix.copyTo(L.shared);
		return r.scale(e.texture.source.pixelWidth, e.texture.source.pixelHeight), n.setTransform(r), n;
	} else if (e.fill instanceof j_) {
		let n = e.fill, r = t.createPattern(n.texture.source.resource, "repeat"), i = n.transform.copyTo(L.shared);
		return i.scale(n.texture.source.pixelWidth, n.texture.source.pixelHeight), r.setTransform(i), r;
	} else if (e.fill instanceof O_) {
		let o = e.fill, s = o.type === "linear", c = o.textureSpace === "local", l = 1, u = 1;
		c && n && (l = n.width + r, u = n.height + r);
		let d, f = !1;
		if (s) {
			let { start: e, end: n } = o;
			d = t.createLinearGradient(e.x * l + i, e.y * u + a, n.x * l + i, n.y * u + a), f = Math.abs(n.x - e.x) < Math.abs((n.y - e.y) * .1);
		} else {
			let { center: e, innerRadius: n, outerCenter: r, outerRadius: s } = o;
			d = t.createRadialGradient(e.x * l + i, e.y * u + a, n * l, r.x * l + i, r.y * u + a, s * l);
		}
		if (f && c && n) {
			let e = n.lineHeight / u;
			for (let t = 0; t < n.lines.length; t++) {
				let i = (t * n.lineHeight + r / 2) / u;
				o.colorStops.forEach((t) => {
					let n = i + t.offset * e;
					n = Math.max(0, Math.min(1, n)), d.addColorStop(Math.floor(n * rS) / rS, F.shared.setValue(t.color).toHex());
				});
			}
		} else o.colorStops.forEach((e) => {
			d.addColorStop(e.offset, F.shared.setValue(e.color).toHex());
		});
		return d;
	}
	return H("FillStyle not recognised", e), "red";
}
var rS, iS = o((() => {
	ye(), R(), q(), U(), k_(), M_(), rS = 1e5;
})), aS, oS = o((() => {
	aS = {
		5: [
			.153388,
			.221461,
			.250301
		],
		7: [
			.071303,
			.131514,
			.189879,
			.214607
		],
		9: [
			.028532,
			.067234,
			.124009,
			.179044,
			.20236
		],
		11: [
			.0093,
			.028002,
			.065984,
			.121703,
			.175713,
			.198596
		],
		13: [
			.002406,
			.009255,
			.027867,
			.065666,
			.121117,
			.174868,
			.197641
		],
		15: [
			489e-6,
			.002403,
			.009246,
			.02784,
			.065602,
			.120999,
			.174697,
			.197448
		]
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/filters/defaults/blur/gl/generateBlurFragSource.mjs
function sS(e) {
	let t = aS[e], n = t.length, r = "";
	for (let i = 0; i < e; i++) {
		let a = i === 0 ? "finalColor = " : "    + ", o = i < n ? i : e - i - 1, s = "texture(uTexture, vBlurTexCoords[%index%]) * %value%".replace("%index%", i.toString()).replace("%value%", t[o].toString());
		r += `${a}${s}
`;
	}
	return cS.replace("%blur%", `${r};`).replace("%size%", e.toString());
}
var cS, lS = o((() => {
	oS(), cS = [
		"in vec2 vBlurTexCoords[%size%];",
		"uniform sampler2D uTexture;",
		"out vec4 finalColor;",
		"void main(void)",
		"{",
		"    %blur%",
		"}"
	].join("\n");
}));
//#endregion
//#region node_modules/pixi.js/lib/filters/defaults/blur/gl/generateBlurVertSource.mjs
function uS(e, t) {
	let n = Math.ceil(e / 2), r = dS, i = "", a;
	a = t ? "vBlurTexCoords[%index%] =  textureCoord + vec2(%sampleIndex% * pixelStrength, 0.0);" : "vBlurTexCoords[%index%] =  textureCoord + vec2(0.0, %sampleIndex% * pixelStrength);";
	for (let t = 0; t < e; t++) {
		let e = a.replace("%index%", t.toString());
		e = e.replace("%sampleIndex%", `${t - (n - 1)}.0`), i += e, i += "\n";
	}
	return r = r.replace("%blur%", i), r = r.replace("%size%", e.toString()), r = r.replace("%dimension%", t ? "z" : "w"), r;
}
var dS, fS = o((() => {
	dS = "\n    in vec2 aPosition;\n\n    uniform float uStrength;\n\n    out vec2 vBlurTexCoords[%size%];\n\n    uniform vec4 uInputSize;\n    uniform vec4 uOutputFrame;\n    uniform vec4 uOutputTexture;\n\n    vec4 filterVertexPosition( void )\n{\n    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\n    vec2 filterTextureCoord( void )\n    {\n        return aPosition * (uOutputFrame.zw * uInputSize.zw);\n    }\n\n    void main(void)\n    {\n        gl_Position = filterVertexPosition();\n\n        float pixelStrength = uInputSize.%dimension% * uStrength;\n\n        vec2 textureCoord = filterTextureCoord();\n        %blur%\n    }";
}));
//#endregion
//#region node_modules/pixi.js/lib/filters/defaults/blur/gl/generateBlurGlProgram.mjs
function pS(e, t) {
	let n = uS(t, e), r = sS(t);
	return qa.from({
		vertex: n,
		fragment: r,
		name: `blur-${e ? "horizontal" : "vertical"}-pass-filter`
	});
}
var mS = o((() => {
	Ja(), lS(), fS();
})), hS, gS = o((() => {
	hS = "\n\nstruct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\nstruct BlurUniforms {\n  uStrength:f32,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n@group(0) @binding(1) var uTexture: texture_2d<f32>;\n@group(0) @binding(2) var uSampler : sampler;\n\n@group(1) @binding(0) var<uniform> blurUniforms : BlurUniforms;\n\n\nstruct VSOutput {\n    @builtin(position) position: vec4<f32>,\n    %blur-struct%\n  };\n\nfn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>\n{\n    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;\n\n    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;\n    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;\n\n    return vec4(position, 0.0, 1.0);\n}\n\nfn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);\n}\n\nfn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>\n{\n  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);\n}\n\nfn getSize() -> vec2<f32>\n{\n  return gfu.uGlobalFrame.zw;\n}\n\n\n@vertex\nfn mainVertex(\n  @location(0) aPosition : vec2<f32>,\n) -> VSOutput {\n\n  let filteredCord = filterTextureCoord(aPosition);\n\n  let pixelStrength = gfu.uInputSize.%dimension% * blurUniforms.uStrength;\n\n  return VSOutput(\n   filterVertexPosition(aPosition),\n    %blur-vertex-out%\n  );\n}\n\n@fragment\nfn mainFragment(\n  @builtin(position) position: vec4<f32>,\n  %blur-fragment-in%\n) -> @location(0) vec4<f32> {\n\n    var   finalColor = vec4(0.0);\n\n    %blur-sampling%\n\n    return finalColor;\n}\n";
}));
//#endregion
//#region node_modules/pixi.js/lib/filters/defaults/blur/gpu/generateBlurProgram.mjs
function _S(e, t) {
	let n = aS[t], r = n.length, i = [], a = [], o = [];
	for (let s = 0; s < t; s++) {
		i[s] = `@location(${s}) offset${s}: vec2<f32>,`, e ? a[s] = `filteredCord + vec2(${s - r + 1} * pixelStrength, 0.0),` : a[s] = `filteredCord + vec2(0.0, ${s - r + 1} * pixelStrength),`;
		let c = n[s < r ? s : t - s - 1].toString();
		o[s] = `finalColor += textureSample(uTexture, uSampler, offset${s}) * ${c};`;
	}
	let s = i.join("\n"), c = a.join("\n"), l = o.join("\n"), u = hS.replace("%blur-struct%", s).replace("%blur-vertex-out%", c).replace("%blur-fragment-in%", s).replace("%blur-sampling%", l).replace("%dimension%", e ? "z" : "w");
	return go.from({
		vertex: {
			source: u,
			entryPoint: "mainVertex"
		},
		fragment: {
			source: u,
			entryPoint: "mainFragment"
		}
	});
}
var vS = o((() => {
	_o(), oS(), gS();
})), yS, bS, xS = o((() => {
	kn(), xo(), Wo(), mS(), vS(), yS = class e extends Uo {
		constructor(t) {
			t = {
				...e.defaultOptions,
				...t
			};
			let n = pS(t.horizontal, t.kernelSize), r = _S(t.horizontal, t.kernelSize);
			super({
				glProgram: n,
				gpuProgram: r,
				resources: { blurUniforms: { uStrength: {
					value: 0,
					type: "f32"
				} } },
				...t
			}), this.horizontal = t.horizontal, this.legacy = t.legacy ?? !1, this._quality = 0, this.quality = t.quality, this.blur = t.strength, this._blurUniforms = this.resources.blurUniforms, this._uniforms = this._blurUniforms.uniforms;
		}
		apply(e, t, n, r) {
			this.legacy ? this._applyLegacy(e, t, n, r) : this._applyOptimized(e, t, n, r);
		}
		_applyLegacy(e, t, n, r) {
			if (this._uniforms.uStrength = this.strength / this.passes, this.passes === 1) e.applyFilter(this, t, n, r);
			else {
				let i = On.getSameSizeTexture(t), a = t, o = i;
				this._state.blend = !1;
				let s = e.renderer.type === bo.WEBGPU;
				for (let t = 0; t < this.passes - 1; t++) {
					e.applyFilter(this, a, o, t === 0 ? !0 : s);
					let n = o;
					o = a, a = n;
				}
				this._state.blend = !0, e.applyFilter(this, a, n, r), On.returnTexture(i);
			}
		}
		_applyOptimized(e, t, n, r) {
			if (this._uniforms.uStrength = this._calculateInitialStrength(), this.passes === 1) e.applyFilter(this, t, n, r);
			else {
				let i = On.getSameSizeTexture(t), a = t, o = i;
				this._state.blend = !1;
				let s = e.renderer, c = s.type === bo.WEBGPU, l = c ? s.renderPipes.uniformBatch : null;
				for (let t = 0; t < this.passes - 1; t++) {
					l && this.groups[1].setResource(l.getUboResource(this._blurUniforms), 0), e.applyFilter(this, a, o, c);
					let t = o;
					o = a, a = t, this._uniforms.uStrength *= .5;
				}
				l && this.groups[1].setResource(l.getUboResource(this._blurUniforms), 0), this._state.blend = !0, e.applyFilter(this, a, n, r), On.returnTexture(i);
			}
		}
		_calculateInitialStrength() {
			let e = 1, t = .5;
			for (let n = 1; n < this.passes; n++) e += t * t, t *= .5;
			return this.strength / Math.sqrt(e);
		}
		get blur() {
			return this.strength;
		}
		set blur(e) {
			this.padding = 1 + Math.abs(e) * 2, this.strength = e;
		}
		get quality() {
			return this._quality;
		}
		set quality(e) {
			this._quality = e, this.passes = e;
		}
	}, yS.defaultOptions = {
		strength: 8,
		quality: 4,
		kernelSize: 5,
		legacy: !1
	}, bS = yS;
})), SS, CS = o((() => {
	kn(), xo(), Le(), Wo(), xS(), SS = class extends Uo {
		constructor(...e) {
			let t = e[0] ?? {};
			typeof t == "number" && (V(B, "BlurFilter constructor params are now options object. See params: { strength, quality, resolution, kernelSize }"), t = { strength: t }, e[1] !== void 0 && (t.quality = e[1]), e[2] !== void 0 && (t.resolution = e[2] || "inherit"), e[3] !== void 0 && (t.kernelSize = e[3])), t = {
				...bS.defaultOptions,
				...t
			};
			let { strength: n, strengthX: r, strengthY: i, quality: a, ...o } = t;
			super({
				...o,
				compatibleRenderers: bo.BOTH,
				resources: {}
			}), this._repeatEdgePixels = !1, this.blurXFilter = new bS({
				horizontal: !0,
				...t
			}), this.blurYFilter = new bS({
				horizontal: !1,
				...t
			}), this.quality = a, this.strengthX = r ?? n, this.strengthY = i ?? n, this.repeatEdgePixels = !1;
		}
		apply(e, t, n, r) {
			let i = Math.abs(this.blurXFilter.strength), a = Math.abs(this.blurYFilter.strength);
			if (i && a) {
				let i = On.getSameSizeTexture(t);
				this.blurXFilter.blendMode = "normal", this.blurXFilter.apply(e, t, i, !0), this.blurYFilter.blendMode = this.blendMode, this.blurYFilter.apply(e, i, n, r), On.returnTexture(i);
			} else a ? (this.blurYFilter.blendMode = this.blendMode, this.blurYFilter.apply(e, t, n, r)) : (this.blurXFilter.blendMode = this.blendMode, this.blurXFilter.apply(e, t, n, r));
		}
		updatePadding() {
			this._repeatEdgePixels ? this.padding = 0 : this.padding = Math.max(Math.abs(this.blurXFilter.blur), Math.abs(this.blurYFilter.blur)) * 2;
		}
		get strength() {
			if (this.strengthX !== this.strengthY) throw Error("BlurFilter's strengthX and strengthY are different");
			return this.strengthX;
		}
		set strength(e) {
			this.blurXFilter.blur = this.blurYFilter.blur = e, this.updatePadding();
		}
		get quality() {
			return this.blurXFilter.quality;
		}
		set quality(e) {
			this.blurXFilter.quality = this.blurYFilter.quality = e;
		}
		get strengthX() {
			return this.blurXFilter.blur;
		}
		set strengthX(e) {
			this.blurXFilter.blur = e, this.updatePadding();
		}
		get strengthY() {
			return this.blurYFilter.blur;
		}
		set strengthY(e) {
			this.blurYFilter.blur = e, this.updatePadding();
		}
		get blur() {
			return V("8.3.0", "BlurFilter.blur is deprecated, please use BlurFilter.strength instead."), this.strength;
		}
		set blur(e) {
			V("8.3.0", "BlurFilter.blur is deprecated, please use BlurFilter.strength instead."), this.strength = e;
		}
		get blurX() {
			return V("8.3.0", "BlurFilter.blurX is deprecated, please use BlurFilter.strengthX instead."), this.strengthX;
		}
		set blurX(e) {
			V("8.3.0", "BlurFilter.blurX is deprecated, please use BlurFilter.strengthX instead."), this.strengthX = e;
		}
		get blurY() {
			return V("8.3.0", "BlurFilter.blurY is deprecated, please use BlurFilter.strengthY instead."), this.strengthY;
		}
		set blurY(e) {
			V("8.3.0", "BlurFilter.blurY is deprecated, please use BlurFilter.strengthY instead."), this.strengthY = e;
		}
		get repeatEdgePixels() {
			return this._repeatEdgePixels;
		}
		set repeatEdgePixels(e) {
			this._repeatEdgePixels = e, this.updatePadding();
		}
	}, SS.defaultOptions = {
		strength: 8,
		quality: 4,
		kernelSize: 5,
		legacy: !1
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/AbstractText.mjs
function wS(e, t) {
	let n = e[0] ?? {};
	return (typeof n == "string" || e[1]) && (V(B, `use new ${t}({ text: "hi!", style }) instead`), n = {
		text: n,
		style: e[1]
	}), n;
}
var TS, ES = o((() => {
	je(), Le(), Lr(), TS = class extends Ir {
		constructor(e, t) {
			let { text: n, resolution: r, style: i, anchor: a, width: o, height: s, roundPixels: c, ...l } = e;
			super({ ...l }), this.batched = !0, this._resolution = null, this._autoResolution = !0, this._didTextUpdate = !0, this._styleClass = t, this.text = n ?? "", this.style = i, this.resolution = r ?? null, this.allowChildren = !1, this._anchor = new Ae({ _onUpdate: () => {
				this.onViewUpdate();
			} }), a && (this.anchor = a), this.roundPixels = c ?? !1, o !== void 0 && (this.width = o), s !== void 0 && (this.height = s);
		}
		get anchor() {
			return this._anchor;
		}
		set anchor(e) {
			typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
		}
		set text(e) {
			e = e.toString(), this._text !== e && (this._text = e, this.onViewUpdate());
		}
		get text() {
			return this._text;
		}
		set resolution(e) {
			this._autoResolution = e === null, this._resolution = e, this.onViewUpdate();
		}
		get resolution() {
			return this._resolution;
		}
		get style() {
			return this._style;
		}
		set style(e) {
			e || (e = {}), this._style?.off("update", this.onViewUpdate, this), e instanceof this._styleClass ? this._style = e : this._style = new this._styleClass(e), this._style.on("update", this.onViewUpdate, this), this.onViewUpdate();
		}
		get width() {
			return Math.abs(this.scale.x) * this.bounds.width;
		}
		set width(e) {
			this._setWidth(e, this.bounds.width);
		}
		get height() {
			return Math.abs(this.scale.y) * this.bounds.height;
		}
		set height(e) {
			this._setHeight(e, this.bounds.height);
		}
		getSize(e) {
			return e || (e = {}), e.width = Math.abs(this.scale.x) * this.bounds.width, e.height = Math.abs(this.scale.y) * this.bounds.height, e;
		}
		setSize(e, t) {
			typeof e == "object" ? (t = e.height ?? e.width, e = e.width) : t ?? (t = e), e !== void 0 && this._setWidth(e, this.bounds.width), t !== void 0 && this._setHeight(t, this.bounds.height);
		}
		containsPoint(e) {
			let t = this.bounds.width, n = this.bounds.height, r = -t * this.anchor.x, i = 0;
			return e.x >= r && e.x <= r + t && (i = -n * this.anchor.y, e.y >= i && e.y <= i + n);
		}
		onViewUpdate() {
			this.didViewUpdate || (this._didTextUpdate = !0), super.onViewUpdate();
		}
		destroy(e = !1) {
			super.destroy(e), this.owner = null, this._bounds = null, this._anchor = null, (typeof e == "boolean" ? e : e?.style) && this._style.destroy(e), this._style = null, this._text = null;
		}
		get styleKey() {
			return `${this._text}:${this._style.styleKey}:${this._resolution}`;
		}
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/utils/canvas/getCanvasBoundingBox.mjs
function DS(e, t) {
	jS || (jS = J.get().createCanvas(256, 128), MS = jS.getContext("2d", { willReadFrequently: !0 }), MS.globalCompositeOperation = "copy", MS.globalAlpha = 1), (jS.width < e || jS.height < t) && (jS.width = Xt(e), jS.height = Xt(t));
}
function OS(e, t, n) {
	for (let r = 0, i = 4 * n * t; r < t; ++r, i += 4) if (e[i + 3] !== 0) return !1;
	return !0;
}
function kS(e, t, n, r, i) {
	let a = 4 * t;
	for (let t = r, o = r * a + 4 * n; t <= i; ++t, o += a) if (e[o + 3] !== 0) return !1;
	return !0;
}
function AS(...e) {
	let t = e[0];
	t.canvas || (t = {
		canvas: e[0],
		resolution: e[1]
	});
	let { canvas: n } = t, r = Math.min(t.resolution ?? 1, 1), i = t.width ?? n.width, a = t.height ?? n.height, o = t.output;
	if (DS(i, a), !MS) throw TypeError("Failed to get canvas 2D context");
	MS.drawImage(n, 0, 0, i, a, 0, 0, i * r, a * r);
	let s = MS.getImageData(0, 0, i, a).data, c = 0, l = 0, u = i - 1, d = a - 1;
	for (; l < a && OS(s, i, l);) ++l;
	if (l === a) return W.EMPTY;
	for (; OS(s, i, d);) --d;
	for (; kS(s, i, c, l, d);) ++c;
	for (; kS(s, i, u, l, d);) --u;
	return ++u, ++d, MS.globalCompositeOperation = "source-over", MS.strokeRect(c, l, u - c, d - l), MS.globalCompositeOperation = "copy", o ?? (o = new W()), o.set(c / r, l / r, (u - c) / r, (d - l) / r), o;
}
var jS, MS, NS = o((() => {
	Y(), Qt(), dt(), jS = null, MS = null;
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/canvas/CanvasTextGenerator.mjs
function PS(e) {
	let t = 0;
	for (let n = 0; n < e.length; n++) e.charCodeAt(n) === 32 && t++;
	return t;
}
var FS, IS, LS, RS = o((() => {
	ye(), dt(), Qp(), NS(), Jx(), Zx(), iS(), FS = new W(), IS = class {
		getCanvasAndContext(e) {
			let { text: t, style: n, resolution: r = 1 } = e, i = n._getFinalPadding(), a = qx.measureText(t || " ", n), o = Math.ceil(Math.ceil(Math.max(1, a.width) + i * 2) * r), s = Math.ceil(Math.ceil(Math.max(1, a.height) + i * 2) * r), c = Zp.getOptimalCanvasAndContext(o, s);
			return this._renderTextToCanvas(n, i, r, c, a), {
				canvasAndContext: c,
				frame: n.trim ? AS({
					canvas: c.canvas,
					width: o,
					height: s,
					resolution: 1,
					output: FS
				}) : FS.set(0, 0, o, s)
			};
		}
		returnCanvasAndContext(e) {
			Zp.returnCanvasAndContext(e);
		}
		_renderTextToCanvas(e, t, n, r, i) {
			if (i.runsByLine && i.runsByLine.length > 0) {
				this._renderTaggedTextToCanvas(i, e, t, n, r);
				return;
			}
			let { canvas: a, context: o } = r, s = Yx(e), c = i.lines, l = i.lineHeight, u = i.lineWidths, d = i.maxLineWidth, f = i.fontProperties, p = a.height;
			if (o.resetTransform(), o.scale(n, n), o.textBaseline = e.textBaseline, e._stroke?.width) {
				let t = e._stroke;
				o.lineWidth = t.width, o.miterLimit = t.miterLimit, o.lineJoin = t.join, o.lineCap = t.cap;
			}
			o.font = s;
			let m, h, g = e.dropShadow ? 2 : 1, _ = e.wordWrap ? Math.max(e.wordWrapWidth, d) : d, v = (e._stroke?.width ?? 0) / 2, y = (l - f.fontSize) / 2;
			l - f.fontSize < 0 && (y = 0);
			for (let a = 0; a < g; ++a) {
				let s = e.dropShadow && a === 0, d = s ? Math.ceil(Math.max(1, p) + t * 2) : 0, g = d * n;
				if (s) this._setupDropShadow(o, e, n, g);
				else {
					let n = e._gradientBounds, r = e._gradientOffset;
					if (n) {
						let a = {
							width: n.width,
							height: n.height,
							lineHeight: n.height,
							lines: i.lines
						};
						this._setFillAndStrokeStyles(o, e, a, t, v, r?.x ?? 0, r?.y ?? 0);
					} else r ? this._setFillAndStrokeStyles(o, e, i, t, v, r.x, r.y) : this._setFillAndStrokeStyles(o, e, i, t, v);
					o.shadowColor = "rgba(0,0,0,0)";
				}
				for (let n = 0; n < c.length; n++) {
					m = v, h = v + n * l + f.ascent + y, m += this._getAlignmentOffset(u[n], _, e.align);
					let i = 0;
					if (e.align === "justify" && e.wordWrap && n < c.length - 1) {
						let e = PS(c[n]);
						e > 0 && (i = (_ - u[n]) / e);
					}
					e._stroke?.width && this._drawLetterSpacing(c[n], e, r, m + t, h + t - d, !0, i), e._fill !== void 0 && this._drawLetterSpacing(c[n], e, r, m + t, h + t - d, !1, i);
				}
			}
		}
		_renderTaggedTextToCanvas(e, t, n, r, i) {
			let { canvas: a, context: o } = i, { runsByLine: s, lineWidths: c, maxLineWidth: l, lineAscents: u, lineHeights: d, hasDropShadow: f } = e, p = a.height;
			o.resetTransform(), o.scale(r, r), o.textBaseline = t.textBaseline;
			let m = f ? 2 : 1, h = t.wordWrap ? Math.max(t.wordWrapWidth, l) : l, g = t._stroke?.width ?? 0;
			for (let e of s) for (let t of e) {
				let e = t.style._stroke?.width ?? 0;
				e > g && (g = e);
			}
			let _ = g / 2, v = [];
			for (let e = 0; e < s.length; e++) {
				let t = s[e], n = [];
				for (let e of t) {
					let t = Yx(e.style);
					o.font = t, n.push({
						width: qx._measureText(e.text, e.style.letterSpacing, o),
						font: t
					});
				}
				v.push(n);
			}
			for (let e = 0; e < m; ++e) {
				let a = f && e === 0, l = a ? Math.ceil(Math.max(1, p) + n * 2) : 0, m = l * r;
				a || (o.shadowColor = "rgba(0,0,0,0)");
				let g = _;
				for (let e = 0; e < s.length; e++) {
					let f = s[e], p = c[e], y = u[e], b = d[e], x = v[e], S = _;
					S += this._getAlignmentOffset(p, h, t.align);
					let C = 0;
					if (t.align === "justify" && t.wordWrap && e < s.length - 1) {
						let e = 0;
						for (let t of f) e += PS(t.text);
						e > 0 && (C = (h - p) / e);
					}
					let w = g + y, T = S + n;
					for (let e = 0; e < f.length; e++) {
						let t = f[e], { width: s, font: c } = x[e];
						if (o.font = c, o.textBaseline = t.style.textBaseline, t.style._stroke?.width) {
							let e = t.style._stroke;
							if (o.lineWidth = e.width, o.miterLimit = e.miterLimit, o.lineJoin = e.join, o.lineCap = e.cap, a) if (t.style.dropShadow) this._setupDropShadow(o, t.style, r, m);
							else {
								let e = PS(t.text);
								T += s + e * C;
								continue;
							}
							else {
								let r = qx.measureFont(c), i = t.style.lineHeight || r.fontSize;
								o.strokeStyle = nS(e, o, {
									width: s,
									height: i,
									lineHeight: i,
									lines: [t.text]
								}, n * 2, T - n, g);
							}
							this._drawLetterSpacing(t.text, t.style, i, T, w + n - l, !0, C);
						}
						let u = PS(t.text);
						T += s + u * C;
					}
					T = S + n;
					for (let e = 0; e < f.length; e++) {
						let t = f[e], { width: s, font: c } = x[e];
						if (o.font = c, o.textBaseline = t.style.textBaseline, t.style._fill !== void 0) {
							if (a) if (t.style.dropShadow) this._setupDropShadow(o, t.style, r, m);
							else {
								let e = PS(t.text);
								T += s + e * C;
								continue;
							}
							else {
								let e = qx.measureFont(c), r = t.style.lineHeight || e.fontSize, i = {
									width: s,
									height: r,
									lineHeight: r,
									lines: [t.text]
								};
								o.fillStyle = nS(t.style._fill, o, i, n * 2, T - n, g);
							}
							this._drawLetterSpacing(t.text, t.style, i, T, w + n - l, !1, C);
						}
						let u = PS(t.text);
						T += s + u * C;
					}
					g += b;
				}
			}
		}
		_setFillAndStrokeStyles(e, t, n, r, i, a = 0, o = 0) {
			if (e.fillStyle = t._fill ? nS(t._fill, e, n, r * 2, a, o) : null, t._stroke?.width) {
				let s = i + r * 2;
				e.strokeStyle = nS(t._stroke, e, n, s, a, o);
			}
		}
		_setupDropShadow(e, t, n, r) {
			e.fillStyle = "black", e.strokeStyle = "black";
			let i = t.dropShadow, a = i.color, o = i.alpha;
			e.shadowColor = F.shared.setValue(a).setAlpha(o).toRgbaString();
			let s = i.blur * n, c = i.distance * n;
			e.shadowBlur = s, e.shadowOffsetX = Math.cos(i.angle) * c, e.shadowOffsetY = Math.sin(i.angle) * c + r;
		}
		_getAlignmentOffset(e, t, n) {
			return n === "right" ? t - e : n === "center" ? (t - e) / 2 : 0;
		}
		_drawLetterSpacing(e, t, n, r, i, a = !1, o = 0) {
			let { context: s } = n, c = t.letterSpacing, l = !1;
			if (qx.experimentalLetterSpacingSupported && (qx.experimentalLetterSpacing ? (s.letterSpacing = `${c}px`, s.textLetterSpacing = `${c}px`, l = !0) : (s.letterSpacing = "0px", s.textLetterSpacing = "0px")), (c === 0 || l) && o === 0) {
				a ? s.strokeText(e, r, i) : s.fillText(e, r, i);
				return;
			}
			if (o !== 0 && (c === 0 || l)) {
				let t = e.split(" "), n = r, c = s.measureText(" ").width;
				for (let e = 0; e < t.length; e++) a ? s.strokeText(t[e], n, i) : s.fillText(t[e], n, i), n += s.measureText(t[e]).width + c + o;
				return;
			}
			let u = r, d = qx.graphemeSegmenter(e), f = s.measureText(e).width, p = 0;
			for (let e = 0; e < d.length; ++e) {
				let t = d[e];
				a ? s.strokeText(t, u, i) : s.fillText(t, u, i);
				let n = "";
				for (let t = e + 1; t < d.length; ++t) n += d[t];
				p = s.measureText(n).width, u += f - p + c, t === " " && (u += o), f = p;
			}
		}
	}, LS = new IS();
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/utils/updateTextBounds.mjs
function zS(e, t) {
	let { texture: n, bounds: r } = e, i = t._style._getFinalPadding();
	zi(r, t._anchor, n);
	let a = t._anchor._x * i * 2, o = t._anchor._y * i * 2;
	r.minX -= i - a, r.minY -= i - o, r.maxX -= i - a, r.maxY -= i - o;
}
var BS = o((() => {
	Bi();
})), VS, HS = o((() => {
	nu(), VS = class extends tu {};
})), US, WS = o((() => {
	g(), If(), BS(), HS(), US = class {
		constructor(e) {
			this._renderer = e, e.runners.resolutionChange.add(this), this._managedTexts = new Ff({
				renderer: e,
				type: "renderable",
				onUnload: this.onTextUnload.bind(this),
				name: "canvasText"
			});
		}
		resolutionChange() {
			for (let e in this._managedTexts.items) {
				let t = this._managedTexts.items[e];
				t?._autoResolution && t.onViewUpdate();
			}
		}
		validateRenderable(e) {
			let t = this._getGpuText(e), n = e.styleKey;
			return t.currentKey === n ? e._didTextUpdate : !0;
		}
		addRenderable(e, t) {
			let n = this._getGpuText(e);
			if (e._didTextUpdate) {
				let t = e._autoResolution ? this._renderer.resolution : e.resolution;
				(n.currentKey !== e.styleKey || e._resolution !== t) && this._updateGpuText(e), e._didTextUpdate = !1, zS(n, e);
			}
			this._renderer.renderPipes.batch.addToBatch(n, t);
		}
		updateRenderable(e) {
			let t = this._getGpuText(e);
			t._batcher.updateElement(t);
		}
		_updateGpuText(e) {
			let t = this._getGpuText(e);
			t.texture && this._renderer.canvasText.decreaseReferenceCount(t.currentKey), e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution, t.texture = this._renderer.canvasText.getManagedTexture(e), t.currentKey = e.styleKey;
		}
		_getGpuText(e) {
			return e._gpuData[this._renderer.uid] || this.initGpuText(e);
		}
		initGpuText(e) {
			let t = new VS();
			return t.currentKey = "--", t.renderable = e, t.transform = e.groupTransform, t.bounds = {
				minX: 0,
				maxX: 1,
				minY: 0,
				maxY: 0
			}, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._gpuData[this._renderer.uid] = t, this._managedTexts.add(e), t;
		}
		onTextUnload(e) {
			let t = e._gpuData[this._renderer.uid];
			if (!t) return;
			let { canvasText: n } = this._renderer;
			n.getReferenceCount(t.currentKey) > 0 ? n.decreaseReferenceCount(t.currentKey) : t.texture && n.returnTexture(t.texture);
		}
		destroy() {
			this._managedTexts.destroy(), this._renderer = null;
		}
	}, US.extension = {
		type: [
			f.WebGLPipes,
			f.WebGPUPipes,
			f.CanvasPipes
		],
		name: "text"
	};
}));
//#endregion
//#region node_modules/pixi.js/lib/scene/text/utils/getPo2TextureFromSource.mjs
function GS(e, t, n, r, i = !1) {
	let a = KS;
	a.minX = 0, a.minY = 0, a.maxX = e.width / r | 0, a.maxY = e.height / r | 0;
	let o = On.getOptimalTexture(a.width, a.height, r, !1, i);
	return o.source.uploadMethodId = "image", o.source.resource = e, o.source.alphaMode = "premultiply-alpha-on-upload", o.frame.width = t / r, o.frame.height = n / r, o.source.emit("update", o.source), o.updateUvs(), o;
}
var KS, qS = o((() => {
	kn(), mt(), KS = new pt();
})), JS, YS = o((() => {
	kn(), on(), Le(), RS(), tS(), qS(), JS = class {
		constructor(e, t) {
			this._activeTextures = {}, this._renderer = e, this._retainCanvasContext = t;
		}
		getTexture(e, t, n, r) {
			typeof e == "string" && (V("8.0.0", "CanvasTextSystem.getTexture: Use object TextOptions instead of separate arguments"), e = {
				text: e,
				style: n,
				resolution: t
			}), e.style instanceof eS || (e.style = new eS(e.style)), e.textureStyle instanceof an || (e.textureStyle = new an(e.textureStyle)), typeof e.text != "string" && (e.text = e.text.toString());
			let { text: i, style: a, textureStyle: o, autoGenerateMipmaps: s } = e, c = e.resolution ?? this._renderer.resolution, { frame: l, canvasAndContext: u } = LS.getCanvasAndContext({
				text: i,
				style: a,
				resolution: c
			}), d = GS(u.canvas, l.width, l.height, c, s);
			if (o && (d.source.style = o), a.trim && (l.pad(a.padding), d.frame.copyFrom(l), d.frame.scale(1 / c), d.updateUvs()), a.filters) {
				let e = this._applyFilters(d, a.filters);
				return this.returnTexture(d), LS.returnCanvasAndContext(u), e;
			}
			return this._renderer.texture.initSource(d._source), this._retainCanvasContext || LS.returnCanvasAndContext(u), d;
		}
		returnTexture(e) {
			let t = e.source, n = t.resource;
			if (this._retainCanvasContext && n?.getContext) {
				let e = n.getContext("2d");
				e && LS.returnCanvasAndContext({
					canvas: n,
					context: e
				});
			}
			t.resource = null, t.uploadMethodId = "unknown", t.alphaMode = "no-premultiply-alpha", On.returnTexture(e, !0);
		}
		renderTextToCanvas() {
			V("8.10.0", "CanvasTextSystem.renderTextToCanvas: no longer supported, use CanvasTextSystem.getTexture instead");
		}
		getManagedTexture(e) {
			e._resolution = e._autoResolution ? this._renderer.resolution : e.resolution;
			let t = e.styleKey;
			if (this._activeTextures[t]) return this._increaseReferenceCount(t), this._activeTextures[t].texture;
			let n = this.getTexture({
				text: e.text,
				style: e.style,
				resolution: e._resolution,
				textureStyle: e.textureStyle,
				autoGenerateMipmaps: e.autoGenerateMipmaps
			});
			return this._activeTextures[t] = {
				texture: n,
				usageCount: 1
			}, n;
		}
		decreaseReferenceCount(e) {
			let t = this._activeTextures[e];
			t && (t.usageCount--, t.usageCount === 0 && (this.returnTexture(t.texture), this._activeTextures[e] = null));
		}
		getReferenceCount(e) {
			return this._activeTextures[e]?.usageCount ?? 0;
		}
		_increaseReferenceCount(e) {
			this._activeTextures[e].usageCount++;
		}
		_applyFilters(e, t) {
			let n = this._renderer.renderTarget.renderTarget, r = this._renderer.filter.generateFilteredTexture({
				texture: e,
				filters: t
			});
			return this._renderer.renderTarget.bind(n, !1), r;
		}
		destroy() {
			this._renderer = null;
			for (let e in this._activeTextures) this._activeTextures[e] && this.returnTexture(this._activeTextures[e].texture);
			this._activeTextures = null;
		}
	};
})), XS, ZS = o((() => {
	g(), YS(), XS = class extends JS {
		constructor(e) {
			super(e, !0);
		}
	}, XS.extension = {
		type: [f.CanvasSystem],
		name: "canvasText"
	};
})), QS, $S = o((() => {
	g(), YS(), QS = class extends JS {
		constructor(e) {
			super(e, !1);
		}
	}, QS.extension = {
		type: [f.WebGLSystem, f.WebGPUSystem],
		name: "canvasText"
	};
})), eC = o((() => {
	g(), WS(), ZS(), $S(), h.add(XS), h.add(QS), h.add(US);
})), tC, nC = o((() => {
	ln(), on(), ES(), RS(), Jx(), tS(), eC(), tC = class extends TS {
		constructor(...e) {
			let t = wS(e, "Text");
			super(t, eS), this.renderPipeId = "text", t.textureStyle && (this.textureStyle = t.textureStyle instanceof an ? t.textureStyle : new an(t.textureStyle)), this.autoGenerateMipmaps = t.autoGenerateMipmaps ?? cn.defaultOptions.autoGenerateMipmaps;
		}
		updateBounds() {
			let e = this._bounds, t = this._anchor, n = 0, r = 0;
			if (this._style.trim) {
				let { frame: e, canvasAndContext: t } = LS.getCanvasAndContext({
					text: this.text,
					style: this._style,
					resolution: 1
				});
				LS.returnCanvasAndContext(t), n = e.width, r = e.height;
			} else {
				let e = qx.measureText(this._text, this._style);
				n = e.width, r = e.height;
			}
			e.minX = -t._x * n, e.maxX = e.minX + n, e.minY = -t._y * r, e.maxY = e.minY + r;
		}
	};
})), rC = o((() => {
	Ns(), Ls(), g(), ya(), Ri(), lx(), ye(), CS(), va(), zn(), Tb(), nC(), tS(), b(), h.add(Ms, Is);
}));
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/typeof.js
function iC(e) {
	"@babel/helpers - typeof";
	return iC = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, iC(e);
}
var aC = o((() => {}));
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/toPrimitive.js
function oC(e, t) {
	if (iC(e) != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (iC(r) != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var sC = o((() => {
	aC();
}));
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/toPropertyKey.js
function cC(e) {
	var t = oC(e, "string");
	return iC(t) == "symbol" ? t : t + "";
}
var lC = o((() => {
	aC(), sC();
}));
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/defineProperty.js
function uC(e, t, n) {
	return (t = cC(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
var dC = o((() => {
	lC();
})), fC = /* @__PURE__ */ s((() => {
	d(), rC(), dC();
	var e = {
		config: null,
		me: null,
		games: null,
		rewards: null,
		selectedGameSlug: null,
		latestResult: null
	}, t = {
		moon: {
			emoji: "🌙",
			label: "Moon",
			tint: 8118262
		},
		rune: {
			emoji: "✨",
			label: "Rune",
			tint: 13682431
		},
		coin: {
			emoji: "🪙",
			label: "Coin",
			tint: 16765286
		},
		ghost: {
			emoji: "👻",
			label: "Ghost",
			tint: 14674175
		},
		crown: {
			emoji: "👑",
			label: "Crown",
			tint: 16765286
		},
		mask: {
			emoji: "🎭",
			label: "Mask",
			tint: 16747586
		},
		gem: {
			emoji: "💎",
			label: "Gem",
			tint: 8317178
		},
		lantern: {
			emoji: "🏮",
			label: "Lantern",
			tint: 16747586
		},
		wild: {
			emoji: "🃏",
			label: "Wild",
			tint: 16735631
		},
		scatter: {
			emoji: "🔮",
			label: "Scatter",
			tint: 9240513
		}
	}, n = 940, r = 520, i = 150, a = 110, o = 18, s = 3, c = class {
		constructor(e) {
			uC(this, "app", void 0), uC(this, "root", new Rn()), uC(this, "reelContainers", []), uC(this, "cellLabels", []), uC(this, "frame", new wb()), uC(this, "highlights", new wb()), uC(this, "glow", new wb()), uC(this, "ready", void 0), this.host = e, this.app = new cx(), this.ready = this.init();
		}
		async init() {
			await this.app.init({
				width: n,
				height: r,
				antialias: !0,
				backgroundAlpha: 0,
				resolution: window.devicePixelRatio || 1
			}), this.host.innerHTML = "", this.host.appendChild(this.app.canvas), this.app.stage.addChild(this.root), this.root.addChild(this.frame, this.glow, this.highlights);
		}
		async showMachine(e, t) {
			await this.ready, this.buildFrame(e);
			let n = t?.grid?.length ? t.grid : E(e);
			this.setGrid(n, e), this.highlightWins(t, e);
		}
		buildFrame(e) {
			let t = e.reelCount, n = F.shared.setValue(e.accent || "#9d7cf2").toNumber(), r = t * i + (t - 1) * o + 80, c = s * a + 120;
			for (this.frame.clear().roundRect(20, 20, r, c, 28).fill({
				color: 1183004,
				alpha: .96
			}).stroke({
				color: n,
				alpha: .45,
				width: 3
			}), this.glow.clear().roundRect(34, 34, r - 28, c - 28, 22).fill({
				color: n,
				alpha: .08
			}); this.reelContainers.length < t;) {
				let e = new Rn();
				e.filters = [new SS({ strength: 0 })], this.root.addChild(e), this.reelContainers.push(e), this.cellLabels.push([]);
			}
			for (; this.reelContainers.length > t;) this.reelContainers.pop()?.destroy({ children: !0 }), this.cellLabels.pop();
			this.reelContainers.forEach((e, t) => {
				e.removeChildren(), this.cellLabels[t] = [], e.x = 42 + t * (i + o), e.y = 58;
				for (let n = 0; n < s; n += 1) {
					let r = new wb().roundRect(0, n * a, i, a - 10, 20).fill({
						color: 525839,
						alpha: .92
					}).stroke({
						color: 16777215,
						alpha: .08,
						width: 2
					}), o = new tC({
						text: "🪙",
						style: new eS({
							fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif",
							fontSize: 44,
							fontWeight: "700",
							fill: 16777215
						})
					});
					o.anchor.set(.5), o.x = i / 2, o.y = n * a + 34;
					let s = new tC({
						text: "Coin",
						style: new eS({
							fontFamily: "Space Grotesk, sans-serif",
							fontSize: 13,
							fontWeight: "700",
							letterSpacing: 1.2,
							fill: 13617375
						})
					});
					s.anchor.set(.5, 0), s.x = i / 2, s.y = n * a + 62, e.addChild(r, o, s), this.cellLabels[t].push(o, s);
				}
			});
		}
		setGrid(e, t) {
			for (let n = 0; n < t.reelCount; n += 1) for (let r = 0; r < s; r += 1) this.setCell(n, r, e[n]?.[r] || t.reelSymbols[0] || "coin");
		}
		setCell(e, t, n) {
			let r = O(n), i = t * 2, a = this.cellLabels[e]?.[i], o = this.cellLabels[e]?.[i + 1];
			!a || !o || (a.text = r.emoji, a.style.fill = r.tint, o.text = r.label.toUpperCase());
		}
		highlightWins(e, t) {
			if (this.highlights.clear(), e) {
				for (let t of e.lineWins || []) for (let [e, n] of t.positions) this.highlights.roundRect(42 + e * (i + o), 58 + n * a, i, a - 10, 20).stroke({
					color: 16765286,
					width: 4,
					alpha: .95
				});
				for (let [t, n] of e.scatter?.positions || []) this.highlights.roundRect(42 + t * (i + o), 58 + n * a, i, a - 10, 20).stroke({
					color: 9240513,
					width: 4,
					alpha: .95
				});
			}
		}
		async spin(e, t) {
			await this.ready, this.highlights.clear();
			let n = e.reelSymbols.length ? e.reelSymbols : [
				"coin",
				"moon",
				"ghost"
			];
			await Promise.all(Array.from({ length: e.reelCount }, (e, r) => this.animateReel(r, n, t.grid[r], r))), this.highlightWins(t, e);
		}
		async animateReel(e, t, n, r) {
			let i = this.reelContainers[e].filters?.[0];
			i && (i.strength = 6), await new Promise((a) => {
				let o = performance.now(), c = 850 + r * 160, l = window.setInterval(() => {
					for (let n = 0; n < s; n += 1) {
						let i = t[(Math.floor(Math.random() * t.length) + n + r) % t.length];
						this.setCell(e, n, i);
					}
					if (performance.now() - o >= c) {
						window.clearInterval(l);
						for (let r = 0; r < s; r += 1) this.setCell(e, r, n[r] || t[0]);
						i && (i.strength = 0), a();
					}
				}, 60);
			});
		}
	};
	async function l() {
		e.config = await k("/api/config"), e.me = await k("/api/me"), T(), await u();
	}
	async function u() {
		let t = document.querySelector("[data-summary]"), n = document.querySelector("[data-content]");
		if (!t || !n || !e.config || !e.me) return;
		if (e.games = await k("/api/casino/games"), !e.me.authenticated) {
			t.innerHTML = C([
				["Machines", String(e.games.games.length)],
				["Format", "5x3 video slots"],
				["Guardrail", "Points only"],
				["Access", "Sign in required"]
			]), n.innerHTML = w(e.config);
			return;
		}
		e.rewards = await k("/api/rewards");
		let r = e.games.games, i = r.find((t) => t.slug === e.selectedGameSlug) || r[0] || null;
		if (!i) {
			t.innerHTML = C([
				["Machines", "0"],
				["Format", "5x3 video slots"],
				["Guardrail", "Points only"],
				["Access", "Ready"]
			]), n.innerHTML = "<div class=\"app-empty\">No slot cabinets are configured yet.</div>";
			return;
		}
		e.selectedGameSlug = i.slug, e.latestResult?.gameSlug !== i.slug && (e.latestResult = null), t.innerHTML = C([
			["Balance", A(e.rewards.balance)],
			["Free spins", String(i.freeSpinsRemaining)],
			["Daily remaining", A(e.rewards.dailyRemaining)],
			["Machines", String(r.length)]
		]), n.innerHTML = h(i, r, e.rewards, e.latestResult), f(), await m(i, e.latestResult), p(i);
	}
	function f() {
		document.querySelectorAll("[data-machine-pick]").forEach((t) => {
			t.addEventListener("click", async () => {
				e.selectedGameSlug = t.dataset.machinePick || null, e.latestResult = null, await u();
			});
		});
	}
	async function p(t) {
		let n = document.querySelector("[data-slot-spin]"), r = document.querySelector("[data-slot-status]"), i = document.querySelector("[data-slot-result]"), a = document.querySelector("[data-slot-stage]");
		if (!n || !r || !i || !a) return;
		let o = new c(a);
		await o.showMachine(t, e.latestResult), n.addEventListener("click", async () => {
			n.disabled = !0, r.textContent = `${t.name} is spinning...`;
			try {
				let n = await k("/api/casino/spin", {
					method: "POST",
					body: JSON.stringify({ gameSlug: t.slug })
				});
				await o.spin(t, n.result), e.latestResult = n.result, r.textContent = D(n.result), x(i, n.result, t), e.me = await k("/api/me"), await u();
			} catch (e) {
				r.textContent = e instanceof Error ? e.message : "Spin failed.", S(i, e instanceof Error ? e.message : "Spin failed.");
			} finally {
				n.disabled = !1;
			}
		});
	}
	async function m(e, t) {
		let n = document.querySelector("[data-slot-stage]");
		n && await new c(n).showMachine(e, t);
	}
	function h(e, t, n, r) {
		return `
    <section class="slot-layout">
      <article class="app-card slot-main">
        <div class="slot-main__header">
          <div>
            <p class="app-kicker">Pixi Slot Floor</p>
            <h3>${j(e.name)}</h3>
            <p class="slot-copy">${j(e.flavor)}</p>
          </div>
          <div class="slot-chips">
            <span class="app-chip">${A(e.cost)} stake</span>
            <span class="app-chip">${e.paylinesCount} paylines</span>
            <span class="app-chip">${j(e.volatility)} volatility</span>
          </div>
        </div>
        <div class="slot-cabinet">
          <div class="slot-stage" data-slot-stage></div>
          <div class="slot-controls">
            <button class="button slot-spin" data-slot-spin>${e.freeSpinsRemaining ? `Play Free Spin (${e.freeSpinsRemaining})` : `Spin ${j(e.name)}`}</button>
            <div class="slot-status app-muted" data-slot-status>${r ? j(D(r)) : "Three scatters trigger free spins. Wilds substitute on paylines."}</div>
          </div>
          <div class="slot-result app-banner" data-slot-result>${b(r, e)}</div>
        </div>
        <div class="slot-footer">
          <div><span class="app-muted">Jackpot</span><strong>${j(e.jackpotLabel || A(e.topPayout))}</strong></div>
          <div><span class="app-muted">Mood</span><strong>${j(e.mood || "Live machine")}</strong></div>
          <div><span class="app-muted">Free spins</span><strong>${e.freeSpinsRemaining ? `${e.freeSpinsRemaining} banked` : "Trigger with 3 scatters"}</strong></div>
          <div><span class="app-muted">Latest balance</span><strong>${A(n.balance)}</strong></div>
        </div>
      </article>
      <aside class="slot-sidebar">
        <section class="app-card">
          <div class="app-card__row">
            <h3>Cabinets</h3>
            <span class="app-chip">${t.length} live</span>
          </div>
          <div class="slot-cabinet-list">
            ${t.map((t) => g(t, t.slug === e.slug)).join("")}
          </div>
        </section>
        <section class="app-card">
          <h3>Player Board</h3>
          ${_(n, e)}
        </section>
      </aside>
    </section>
    <section class="slot-bottom">
      <article class="app-card">
        <div class="app-card__row">
          <h3>Paytable</h3>
          <span class="app-chip">Wild + scatter enabled</span>
        </div>
        ${v(e.paytable)}
      </article>
      <article class="app-card">
        <div class="app-card__row">
          <h3>Recent Spins</h3>
          <span class="app-chip">${n.spins.length} logged</span>
        </div>
        ${y(n.spins)}
      </article>
    </section>
  `;
	}
	function g(e, t) {
		return `
    <button class="slot-machine-button ${t ? "is-active" : ""}" data-machine-pick="${j(e.slug)}" type="button">
      <div class="slot-machine-button__top">
        <strong>${j(e.name)}</strong>
        <span>${A(e.cost)}</span>
      </div>
      <div class="slot-machine-button__meta">
        <span>${j(e.volatility)} volatility</span>
        <span>${e.freeSpinsRemaining ? `${e.freeSpinsRemaining} free spins` : `${e.paylinesCount} lines`}</span>
      </div>
      <div class="slot-machine-button__symbols">
        ${e.reelSymbols.slice(0, 6).map((e) => `<span class="slot-chip">${O(e).emoji}</span>`).join("")}
      </div>
    </button>
  `;
	}
	function _(e, t) {
		let n = e.spins.find((e) => e.payout > 0);
		return `
    <div class="slot-player-grid">
      <div class="slot-player-stat"><span class="app-muted">Balance</span><strong>${A(e.balance)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Current cabinet</span><strong>${j(t.name)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Wagered today</span><strong>${A(e.dailyWagered)}</strong></div>
      <div class="slot-player-stat"><span class="app-muted">Last win</span><strong>${n ? A(n.payout) : "Waiting"}</strong></div>
    </div>
    <div class="slot-meter">
      <div class="slot-meter__track"><span class="slot-meter__fill" style="width:${Math.min(100, e.dailyWagered / Math.max(1, e.dailyCap) * 100)}%"></span></div>
      <div class="app-muted">${A(e.dailyRemaining)} remaining before the daily cap.</div>
    </div>
  `;
	}
	function v(e) {
		return `
    <div class="slot-paytable">
      ${e.map((e) => `
        <div class="slot-paytable__row">
          <div class="slot-paytable__symbols">${e.symbols.map((e) => `<span class="slot-chip">${O(e).emoji}</span>`).join("")}</div>
          <div class="slot-paytable__copy">
            <strong>${j(e.label)}</strong>
            <span class="app-muted">${e.kind === "scatter" ? `${e.freeSpins || 0} free spins` : `${e.multiplier}x total bet`}</span>
          </div>
          <div class="slot-paytable__value">${A(e.payout)}</div>
        </div>
      `).join("")}
    </div>
  `;
	}
	function y(e) {
		return e.length ? `
    <div class="slot-history">
      ${e.slice(0, 8).map((e) => `
        <div class="slot-history__row">
          <div>
            <strong>${j(e.game)}</strong>
            <div class="app-muted">${e.symbols.map((e) => O(e).emoji).join(" ")} ${j(e.outcome.label)}</div>
          </div>
          <div class="app-muted">${e.usedFreeSpin ? "Free spin" : A(e.wager)}</div>
          <div class="slot-history__value ${e.payout > 0 ? "is-win" : ""}">${e.net >= 0 ? "+" : ""}${A(e.net)}</div>
        </div>
      `).join("")}
    </div>
  ` : "<div class=\"app-empty\">Your most recent spins will show up here.</div>";
	}
	function b(e, t) {
		return e ? `
    <div class="slot-result__label">${j(e.outcome.label)}</div>
    <div class="slot-result__headline">${j(e.outcome.headline)}</div>
    <div class="slot-result__copy">${j(e.outcome.detail)}</div>
    <div class="slot-result__symbols">${e.symbols.map((e) => `<span class="slot-chip">${O(e).emoji}</span>`).join("")}</div>
  ` : `
      <div class="slot-result__label">Ready</div>
      <div class="slot-result__headline">${j(t.name)} is loaded.</div>
      <div class="slot-result__copy">Hit paylines from left to right. Three scatters trigger the feature.</div>
    `;
	}
	function x(e, t, n) {
		e.innerHTML = b(t, n);
	}
	function S(e, t) {
		e.innerHTML = `<div class="slot-result__label">Error</div><div class="slot-result__headline">Spin failed.</div><div class="slot-result__copy">${j(t)}</div>`;
	}
	function C(e) {
		return e.map(([e, t]) => `
    <article class="app-stat">
      <div class="app-stat__value">${t}</div>
      <div class="app-stat__label">${j(e)}</div>
    </article>
  `).join("");
	}
	function w(e) {
		let t = e.authConfigured ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}` : e.devAuthEnabled ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}` : "";
		return `
    <div class="app-empty">
      <p>Sign in to play the Pixi-powered slot floor and store your spins on the Ghosted backend.</p>
      ${t ? `<a class="button" href="${t}">Sign In With Discord</a>` : "<p class=\"app-muted\">Configure Discord auth to enable play.</p>"}
    </div>
  `;
	}
	function T() {
		let t = document.querySelector("[data-auth]");
		if (!t || !e.config || !e.me) return;
		if (!e.me.authenticated) {
			let n = e.config.authConfigured ? `/auth/discord/login?next=${encodeURIComponent(window.location.pathname)}` : e.config.devAuthEnabled ? `/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}` : "#";
			t.innerHTML = n === "#" ? "<div class=\"app-muted\">Discord auth needs env vars before sign-in goes live.</div>" : `<a class="button" href="${n}">Sign In With Discord</a>`;
			return;
		}
		let n = e.me.user;
		t.innerHTML = `
    <div class="app-user">
      ${n.avatarUrl ? `<img class="app-user__avatar" src="${n.avatarUrl}" alt="${j(n.displayName)}" />` : `<div class="app-user__avatar">${j(n.displayName.slice(0, 1).toUpperCase())}</div>`}
      <div>
        <div><strong>${j(n.displayName)}</strong></div>
        <div class="app-muted">${A(n.balance)} points</div>
      </div>
    </div>
    ${n.isAdmin ? "<a class=\"app-nav__link\" href=\"/admin/\">Admin</a>" : ""}
    <button class="button button--secondary" data-logout>Log Out</button>
  `, t.querySelector("[data-logout]")?.addEventListener("click", async () => {
			await k("/auth/logout", { method: "POST" }), window.location.reload();
		});
	}
	function E(e) {
		return Array.from({ length: e.reelCount }, (t, n) => Array.from({ length: s }, (t, r) => e.reelSymbols[(n + r) % e.reelSymbols.length] || "coin"));
	}
	function D(e) {
		return e.freeSpinsAwarded ? `${e.freeSpinsAwarded} free spins awarded with ${e.scatter.count} scatters.` : e.usedFreeSpin ? e.payout > 0 ? `Free spin paid ${A(e.payout)}. ${e.freeSpinsRemaining} free spins remain.` : `Free spin used. ${e.freeSpinsRemaining} free spins remain.` : e.payout > 0 ? `Paid ${A(e.payout)} across ${e.lineWins.length || 1} winning lines.` : `No line hit. Net ${A(e.net)} on that spin.`;
	}
	function O(e) {
		return t[e] || {
			emoji: "❔",
			label: e || "Unknown",
			tint: 16777215
		};
	}
	async function k(e, t = {}) {
		let n = await fetch(e, {
			headers: {
				"Content-Type": "application/json",
				...t.headers || {}
			},
			...t
		}), r = await n.json().catch(() => ({}));
		if (!n.ok) throw Error(r.error || `Request failed for ${e}`);
		return r;
	}
	function A(e) {
		return `${Number(e || 0).toLocaleString()} pts`;
	}
	function j(e) {
		return String(e ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
	}
	l().catch((e) => {
		let t = document.querySelector("[data-banner]");
		t && (t.innerHTML = `<div class="app-banner is-error">${j(e instanceof Error ? e.message : "Casino boot failed.")}</div>`);
	});
}));
//#endregion
export default fC();
