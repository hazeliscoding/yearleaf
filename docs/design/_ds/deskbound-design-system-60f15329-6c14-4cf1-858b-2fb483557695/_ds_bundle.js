/* @ds-bundle: {"format":4,"namespace":"DeskboundDesignSystem_60f153","components":[{"name":"CalendarCell","sourcePath":"components/calendar/CalendarCell.jsx"},{"name":"DateNavigator","sourcePath":"components/calendar/DateNavigator.jsx"},{"name":"DateNumber","sourcePath":"components/calendar/DateNumber.jsx"},{"name":"LayerPanel","sourcePath":"components/calendar/LayerPanel.jsx"},{"name":"MonthHeader","sourcePath":"components/calendar/MonthHeader.jsx"},{"name":"RangeBar","sourcePath":"components/calendar/RangeBar.jsx"},{"name":"WeekHeader","sourcePath":"components/calendar/WeekHeader.jsx"},{"name":"ZoomControl","sourcePath":"components/calendar/ZoomControl.jsx"},{"name":"EventObject","sourcePath":"components/canvas/EventObject.jsx"},{"name":"FileAttachment","sourcePath":"components/canvas/FileAttachment.jsx"},{"name":"Highlight","sourcePath":"components/canvas/Highlight.jsx"},{"name":"ImageObject","sourcePath":"components/canvas/ImageObject.jsx"},{"name":"SelectionBox","sourcePath":"components/canvas/SelectionBox.jsx"},{"name":"StickyNote","sourcePath":"components/canvas/StickyNote.jsx"},{"name":"TaskObject","sourcePath":"components/canvas/TaskObject.jsx"},{"name":"TextObject","sourcePath":"components/canvas/TextObject.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Kbd","sourcePath":"components/core/Kbd.jsx"},{"name":"ToolButton","sourcePath":"components/core/ToolButton.jsx"},{"name":"Toolbar","sourcePath":"components/core/Toolbar.jsx"},{"name":"ToolbarDivider","sourcePath":"components/core/Toolbar.jsx"},{"name":"Tooltip","sourcePath":"components/core/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"ColorPicker","sourcePath":"components/forms/ColorPicker.jsx"},{"name":"DatePicker","sourcePath":"components/forms/DatePicker.jsx"},{"name":"TimeField","sourcePath":"components/forms/DatePicker.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"TextArea","sourcePath":"components/forms/Input.jsx"},{"name":"NumberField","sourcePath":"components/forms/NumberField.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Slider","sourcePath":"components/forms/Slider.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"},{"name":"CommandPalette","sourcePath":"components/overlays/CommandPalette.jsx"},{"name":"ContextMenu","sourcePath":"components/overlays/ContextMenu.jsx"},{"name":"InspectorPanel","sourcePath":"components/overlays/InspectorPanel.jsx"},{"name":"InspectorGroup","sourcePath":"components/overlays/InspectorPanel.jsx"},{"name":"InspectorRow","sourcePath":"components/overlays/InspectorPanel.jsx"},{"name":"Modal","sourcePath":"components/overlays/Modal.jsx"},{"name":"Popover","sourcePath":"components/overlays/Popover.jsx"}],"sourceHashes":{"components/calendar/CalendarCell.jsx":"1634abb026f3","components/calendar/DateNavigator.jsx":"0c91075ff403","components/calendar/DateNumber.jsx":"e459688f2948","components/calendar/LayerPanel.jsx":"c648305f0aa6","components/calendar/MonthHeader.jsx":"c07fb1bc9e23","components/calendar/RangeBar.jsx":"52b7be4c068e","components/calendar/WeekHeader.jsx":"10ccfd173b70","components/calendar/ZoomControl.jsx":"8592915af80e","components/canvas/EventObject.jsx":"63a827d0e141","components/canvas/FileAttachment.jsx":"49c5dbf48e95","components/canvas/Highlight.jsx":"32ae52dd59db","components/canvas/ImageObject.jsx":"1af85f62ed14","components/canvas/SelectionBox.jsx":"a2d49255872b","components/canvas/StickyNote.jsx":"4078cf178ab4","components/canvas/TaskObject.jsx":"f27e381abbe2","components/canvas/TextObject.jsx":"df892d101dce","components/core/Button.jsx":"11a3adb2064e","components/core/Icon.jsx":"3a75b454b2f7","components/core/Kbd.jsx":"f1f4d710a2d7","components/core/ToolButton.jsx":"5dd9912d7477","components/core/Toolbar.jsx":"390bcacfb9f1","components/core/Tooltip.jsx":"61279732e168","components/forms/Checkbox.jsx":"53288059e8c0","components/forms/ColorPicker.jsx":"41b5d093df80","components/forms/DatePicker.jsx":"ec05369c3c08","components/forms/Field.jsx":"bb4b9c51f4d7","components/forms/Input.jsx":"c8f96a916d77","components/forms/NumberField.jsx":"c96afd284479","components/forms/Radio.jsx":"3edf5b1eba5f","components/forms/SearchField.jsx":"c61b48be1d3e","components/forms/SegmentedControl.jsx":"cdc273897db8","components/forms/Select.jsx":"93687a2dfd27","components/forms/Slider.jsx":"a437a5e33d69","components/forms/Toggle.jsx":"8e024ae31e0e","components/overlays/CommandPalette.jsx":"da7f0a4e7c9d","components/overlays/ContextMenu.jsx":"20c1739c6e73","components/overlays/InspectorPanel.jsx":"0761178715f9","components/overlays/Modal.jsx":"76fa4161eed1","components/overlays/Popover.jsx":"cad0498b80f7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DeskboundDesignSystem_60f153 = window.DeskboundDesignSystem_60f153 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/calendar/DateNumber.jsx
try { (() => {
function DateNumber({
  day,
  kind,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "db-datenum",
    "data-kind": kind,
    style: style
  }, day);
}
Object.assign(__ds_scope, { DateNumber });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/DateNumber.jsx", error: String((e && e.message) || e) }); }

// components/calendar/CalendarCell.jsx
try { (() => {
function CalendarCell({
  day,
  today,
  weekend,
  outside,
  selected,
  disabled,
  holiday,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-cell",
    "data-weekend": !!weekend,
    "data-outside": !!outside,
    "data-selected": !!selected,
    "data-disabled": !!disabled,
    style: style
  }, /*#__PURE__*/React.createElement(__ds_scope.DateNumber, {
    day: day,
    kind: today ? 'today' : holiday ? 'holiday' : selected ? 'selected' : undefined
  }), children);
}
Object.assign(__ds_scope, { CalendarCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/CalendarCell.jsx", error: String((e && e.message) || e) }); }

// components/calendar/WeekHeader.jsx
try { (() => {
const NAMES = {
  full: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  abbr: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  narrow: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
};
function WeekHeader({
  format = 'abbr',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-weekhead",
    style: style
  }, NAMES[format].map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      color: i > 4 ? 'var(--ink-disabled)' : undefined,
      paddingLeft: 6
    }
  }, d)));
}
Object.assign(__ds_scope, { WeekHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/WeekHeader.jsx", error: String((e && e.message) || e) }); }

// components/canvas/Highlight.jsx
try { (() => {
function Highlight({
  color = 'yellow',
  area,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("mark", {
    className: 'db-hl' + (area ? ' db-hl--area' : ''),
    style: {
      background: 'color-mix(in srgb,var(--stationery-' + color + ') 55%,transparent)',
      color: 'inherit',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Highlight });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/Highlight.jsx", error: String((e && e.message) || e) }); }

// components/canvas/SelectionBox.jsx
try { (() => {
function SelectionBox({
  selected = true,
  locked,
  group,
  dragging,
  rotatable,
  children,
  style
}) {
  const hs = [['-4px', '-4px'], ['-4px', null, '-4px'], [null, '-4px', null, '-4px'], [null, null, '-4px', '-4px']];
  return /*#__PURE__*/React.createElement("div", {
    className: "db-selbox",
    "data-sel": selected,
    "data-locked": !!locked,
    "data-group": !!group,
    "data-drag": !!dragging,
    style: style
  }, children, selected && /*#__PURE__*/React.createElement("span", {
    className: "db-sel-outline"
  }), selected && !locked && hs.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "db-h",
    style: {
      top: p[0],
      left: p[1],
      bottom: p[2],
      right: p[3]
    }
  })), selected && !locked && rotatable && /*#__PURE__*/React.createElement("span", {
    className: "db-rot"
  }));
}
Object.assign(__ds_scope, { SelectionBox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/SelectionBox.jsx", error: String((e && e.message) || e) }); }

// components/canvas/TaskObject.jsx
try { (() => {
const PRI = {
  high: 'var(--danger)',
  med: 'var(--warning)',
  low: 'var(--info)'
};
function TaskObject({
  label,
  done,
  due,
  priority,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "db-task",
    "data-done": !!done,
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-check",
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: done,
    onChange: onToggle,
    readOnly: !onToggle
  })), /*#__PURE__*/React.createElement("span", {
    className: "db-task-label"
  }, label), due && /*#__PURE__*/React.createElement("span", {
    className: "db-task-due"
  }, due), priority && /*#__PURE__*/React.createElement("span", {
    className: "db-task-pri",
    style: {
      background: PRI[priority] || PRI.med
    },
    title: priority + ' priority'
  }));
}
Object.assign(__ds_scope, { TaskObject });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/TaskObject.jsx", error: String((e && e.message) || e) }); }

// components/canvas/TextObject.jsx
try { (() => {
function TextObject({
  state = 'idle',
  hand,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'db-textobj' + (hand ? ' db-textobj--hand' : ''),
    "data-state": state,
    style: style
  }, children, state === 'editing' && /*#__PURE__*/React.createElement("span", {
    style: {
      borderLeft: '1.5px solid var(--selection)',
      marginLeft: 1,
      animation: 'none'
    }
  }, "\u200B"));
}
Object.assign(__ds_scope, { TextObject });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/TextObject.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
// Lucide glyph by kebab-case name. Renders the SVG itself (requires the lucide UMD script) — safe across React re-renders.
function Icon({
  name,
  size = 16,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    const L = window.lucide;
    if (!el || !L) return;
    el.innerHTML = '';
    const pas = name.split('-').map(s => s ? s[0].toUpperCase() + s.slice(1) : s).join('');
    const node = L[pas] || L.icons && L.icons[pas];
    if (node) {
      const svg = L.createElement(node);
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('stroke-width', '1.5');
      el.appendChild(svg);
    }
  }, [name, size]);
  return React.createElement('span', {
    ref,
    'aria-hidden': true,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flex: 'none',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/calendar/LayerPanel.jsx
try { (() => {
function LayerPanel({
  layers = [],
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 184,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-standard)',
      boxShadow: 'var(--shadow-1)',
      padding: 4,
      font: 'var(--text-body-small)',
      ...style
    }
  }, layers.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '4px 6px',
      borderRadius: 'var(--radius-subtle)',
      opacity: l.visible === false ? .5 : 1
    },
    className: "db-layerrow"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: 'var(--stationery-' + (l.color || 'blue') + ')',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, l.name), l.locked && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "lock",
    size: 11,
    style: {
      color: 'var(--ink-muted)'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    style: {
      width: 20,
      height: 20
    },
    "aria-label": (l.visible === false ? 'Show ' : 'Hide ') + l.name,
    onClick: () => onToggle && onToggle(i)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: l.visible === false ? 'eye-off' : 'eye',
    size: 12
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "grip-vertical",
    size: 11,
    style: {
      color: 'var(--ink-disabled)',
      cursor: 'grab'
    }
  }))));
}
Object.assign(__ds_scope, { LayerPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/LayerPanel.jsx", error: String((e && e.message) || e) }); }

// components/calendar/RangeBar.jsx
try { (() => {
const KINDS = {
  vacation: {
    c: 'mint',
    icon: 'sun'
  },
  project: {
    c: 'indigo',
    icon: 'pen-line'
  },
  travel: {
    c: 'coral',
    icon: 'plane'
  },
  deadline: {
    c: 'red',
    icon: 'flag'
  }
};
function RangeBar({
  label,
  kind = 'project',
  color,
  style
}) {
  const k = KINDS[kind] || KINDS.project;
  const c = color || k.c;
  return /*#__PURE__*/React.createElement("div", {
    className: 'db-range' + (kind === 'deadline' ? ' db-range--deadline' : ''),
    style: {
      background: 'color-mix(in srgb,var(--stationery-' + c + ') 45%,var(--surface-raised))',
      color: 'var(--stationery-' + c + '-ink)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: k.icon,
    size: 10
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label));
}
Object.assign(__ds_scope, { RangeBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/RangeBar.jsx", error: String((e && e.message) || e) }); }

// components/calendar/ZoomControl.jsx
try { (() => {
function ZoomControl({
  zoom = 100,
  onZoomIn,
  onZoomOut,
  onFitMonth,
  onFitYear,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-standard)',
      boxShadow: 'var(--shadow-1)',
      padding: 2,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    style: {
      width: 24,
      height: 24
    },
    onClick: onZoomOut,
    "aria-label": "Zoom out"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "minus",
    size: 12
  })), /*#__PURE__*/React.createElement("span", {
    className: "db-numeral",
    style: {
      font: 'var(--text-numeral-sm)',
      fontFeatureSettings: 'var(--numeral-features)',
      minWidth: 38,
      textAlign: 'center',
      color: 'var(--ink-secondary)'
    }
  }, zoom, "%"), /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    style: {
      width: 24,
      height: 24
    },
    onClick: onZoomIn,
    "aria-label": "Zoom in"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "plus",
    size: 12
  })), /*#__PURE__*/React.createElement("span", {
    className: "db-toolbar-divider",
    style: {
      margin: '2px 2px'
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "db-btn db-btn--sm db-btn--subtle",
    onClick: onFitMonth
  }, "Fit month"), /*#__PURE__*/React.createElement("button", {
    className: "db-btn db-btn--sm db-btn--subtle",
    onClick: onFitYear
  }, "Fit year"));
}
Object.assign(__ds_scope, { ZoomControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/ZoomControl.jsx", error: String((e && e.message) || e) }); }

// components/canvas/EventObject.jsx
try { (() => {
// variant: 'timed'|'allday'|'tentative'|'completed'; multi-day via style width; expanded shows metadata
function EventObject({
  title,
  time,
  color = 'blue',
  variant = 'timed',
  recurring,
  reminder,
  expanded,
  meta,
  style
}) {
  const cls = ['db-event', variant !== 'timed' && 'db-event--' + variant, expanded && 'db-event--expanded'].filter(Boolean).join(' ');
  const head = /*#__PURE__*/React.createElement(React.Fragment, null, time && /*#__PURE__*/React.createElement("span", {
    className: "db-event-time"
  }, time), /*#__PURE__*/React.createElement("span", {
    className: "db-event-title",
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title), recurring && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "repeat",
    size: 11
  }), reminder && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bell",
    size: 11
  }), variant === 'completed' && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 11
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: {
      '--ec': 'var(--stationery-' + color + ')',
      '--eci': 'var(--stationery-' + color + '-ink)',
      ...style
    }
  }, expanded ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, head), meta && /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--ink-muted)'
    }
  }, meta)) : head);
}
Object.assign(__ds_scope, { EventObject });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/EventObject.jsx", error: String((e && e.message) || e) }); }

// components/canvas/FileAttachment.jsx
try { (() => {
const KINDS = {
  pdf: {
    icon: 'file-text',
    c: '--stationery-red'
  },
  doc: {
    icon: 'file-text',
    c: '--stationery-blue'
  },
  sheet: {
    icon: 'table-2',
    c: '--stationery-green'
  },
  link: {
    icon: 'link-2',
    c: '--stationery-teal'
  },
  file: {
    icon: 'file',
    c: '--stationery-olive'
  }
};
function FileAttachment({
  name,
  kind = 'file',
  meta,
  style
}) {
  const k = KINDS[kind] || KINDS.file;
  return /*#__PURE__*/React.createElement("div", {
    className: "db-file",
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-file-icon",
    style: {
      background: 'var(' + k.c + '-soft)',
      color: 'var(' + k.c + '-ink)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: k.icon,
    size: 14
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("div", null, name), meta && /*#__PURE__*/React.createElement("div", {
    className: "db-file-meta"
  }, meta)));
}
Object.assign(__ds_scope, { FileAttachment });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/FileAttachment.jsx", error: String((e && e.message) || e) }); }

// components/canvas/ImageObject.jsx
try { (() => {
function ImageObject({
  src,
  frame = 'borderless',
  caption,
  width = 150,
  height = 100,
  style
}) {
  const cls = ['db-imgobj', frame !== 'borderless' && frame !== 'captioned' && 'db-imgobj--' + frame].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("figure", {
    className: cls,
    style: {
      margin: 0,
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: caption || '',
    style: {
      width,
      height
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "db-img",
    style: {
      width,
      height
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "image",
    size: 18
  })), (caption || frame === 'captioned') && /*#__PURE__*/React.createElement("figcaption", {
    className: "db-img-cap"
  }, caption || 'Add a caption'));
}
Object.assign(__ds_scope, { ImageObject });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/ImageObject.jsx", error: String((e && e.message) || e) }); }

// components/canvas/StickyNote.jsx
try { (() => {
// variant: 'standard'|'compact'|'large'; checklist via items; handwritten via hand
function StickyNote({
  color = 'yellow',
  variant = 'standard',
  hand,
  items,
  pinned,
  folded,
  locked,
  children,
  style
}) {
  const cls = ['db-sticky', variant !== 'standard' && 'db-sticky--' + variant, hand && 'db-sticky--hand'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    "data-folded": !!folded,
    style: {
      '--sc': 'var(--stationery-' + color + ')',
      '--sci': 'var(--stationery-' + color + '-ink)',
      ...style
    }
  }, pinned && /*#__PURE__*/React.createElement("span", {
    className: "db-pin",
    "aria-label": "Pinned"
  }), locked && /*#__PURE__*/React.createElement("span", {
    className: "db-lockmark"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "lock",
    size: 10
  })), items ? /*#__PURE__*/React.createElement("ul", null, items.map((it, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    "data-done": !!it.done
  }, /*#__PURE__*/React.createElement("i", {
    className: "db-box"
  }), /*#__PURE__*/React.createElement("span", null, it.label)))) : children);
}
Object.assign(__ds_scope, { StickyNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/StickyNote.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function Button({
  variant = 'secondary',
  size,
  icon,
  iconOnly,
  disabled,
  children,
  onClick,
  style,
  title
}) {
  const cls = ['db-btn', variant !== 'secondary' && 'db-btn--' + variant, size && 'db-btn--' + size, iconOnly && 'db-btn--icon'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", {
    className: cls,
    disabled: disabled,
    onClick: onClick,
    style: style,
    title: title,
    "aria-label": iconOnly ? title : undefined
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 13 : 14
  }), !iconOnly && children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/calendar/MonthHeader.jsx
try { (() => {
function MonthHeader({
  month,
  year,
  onPrev,
  onNext,
  onToday,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-month-title)'
    }
  }, month), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-month-title)',
      color: 'var(--ink-muted)',
      fontWeight: 400
    }
  }, year), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    iconOnly: true,
    icon: "chevron-left",
    variant: "ghost",
    size: "sm",
    title: "Previous month",
    onClick: onPrev
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "subtle",
    size: "sm",
    onClick: onToday
  }, "Today"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    iconOnly: true,
    icon: "chevron-right",
    variant: "ghost",
    size: "sm",
    title: "Next month",
    onClick: onNext
  })));
}
Object.assign(__ds_scope, { MonthHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/MonthHeader.jsx", error: String((e && e.message) || e) }); }

// components/core/Kbd.jsx
try { (() => {
function Kbd({
  keys,
  children
}) {
  const ks = keys || (typeof children === 'string' ? children.split('+').map(s => s.trim()) : [children]);
  return /*#__PURE__*/React.createElement("span", {
    className: "db-kbd"
  }, ks.map((k, i) => /*#__PURE__*/React.createElement("kbd", {
    key: i
  }, k)));
}
Object.assign(__ds_scope, { Kbd });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/calendar/DateNavigator.jsx
try { (() => {
function DateNavigator({
  label = 'September 2026',
  zoomLabel = 'Month',
  onJump,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 6px 4px 10px',
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-standard)',
      boxShadow: 'var(--shadow-1)',
      font: 'var(--text-body-small)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "calendar",
    size: 13
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 13px var(--font-calendar)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-metadata)',
      color: 'var(--ink-muted)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-metadata)'
    }
  }, zoomLabel), /*#__PURE__*/React.createElement("button", {
    className: "db-btn db-btn--sm db-btn--subtle",
    onClick: onJump
  }, "Jump to date ", /*#__PURE__*/React.createElement(__ds_scope.Kbd, {
    keys: ['⌘', 'J']
  })));
}
Object.assign(__ds_scope, { DateNavigator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/DateNavigator.jsx", error: String((e && e.message) || e) }); }

// components/core/ToolButton.jsx
try { (() => {
function ToolButton({
  icon,
  label,
  shortcut,
  active,
  temp,
  disabled,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "db-tipwrap",
    style: style
  }, /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    "data-active": !!active,
    "data-temp": !!temp,
    disabled: disabled,
    onClick: onClick,
    "aria-label": label,
    "aria-pressed": !!active
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon
  }), shortcut && /*#__PURE__*/React.createElement("span", {
    className: "db-tool-key"
  }, shortcut)), label && /*#__PURE__*/React.createElement("span", {
    className: "db-tip",
    role: "tooltip"
  }, label, shortcut && /*#__PURE__*/React.createElement("span", {
    className: "db-kbd"
  }, /*#__PURE__*/React.createElement("kbd", null, shortcut))));
}
Object.assign(__ds_scope, { ToolButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ToolButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Toolbar.jsx
try { (() => {
function Toolbar({
  vertical,
  floating,
  children,
  style
}) {
  const cls = ['db-toolbar', vertical && 'db-toolbar--vertical', floating && 'db-toolbar--floating'].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    role: "toolbar",
    style: style
  }, children);
}
function ToolbarDivider() {
  return /*#__PURE__*/React.createElement("span", {
    className: "db-toolbar-divider"
  });
}
Object.assign(__ds_scope, { Toolbar, ToolbarDivider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toolbar.jsx", error: String((e && e.message) || e) }); }

// components/core/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  shortcut,
  secondary,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "db-tipwrap"
  }, children, /*#__PURE__*/React.createElement("span", {
    className: "db-tip",
    role: "tooltip"
  }, label, secondary && /*#__PURE__*/React.createElement("small", null, secondary), shortcut && /*#__PURE__*/React.createElement(__ds_scope.Kbd, {
    keys: shortcut
  })));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  defaultChecked,
  indeterminate,
  disabled,
  onChange
}) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return /*#__PURE__*/React.createElement("label", {
    className: "db-check"
  }, /*#__PURE__*/React.createElement("input", {
    ref: ref,
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    disabled: disabled,
    onChange: onChange
  }), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/ColorPicker.jsx
try { (() => {
const GROUPS = [['Ink', ['--ink-primary', '--stationery-red-ink', '--stationery-blue-ink', '--stationery-green-ink', '--stationery-violet-ink', '--accent']], ['Highlighter', ['--stationery-yellow', '--stationery-orange', '--stationery-mint', '--stationery-blue', '--stationery-rose', '--stationery-lavender']], ['Sticky note', ['--stationery-yellow', '--stationery-coral', '--stationery-green', '--stationery-teal', '--stationery-indigo', '--stationery-olive']]];
function ColorPicker({
  value,
  onChange,
  recent = [],
  compact,
  style
}) {
  const Sw = ({
    c,
    round
  }) => /*#__PURE__*/React.createElement("button", {
    className: 'db-swatch' + (round ? ' db-swatch--round' : ''),
    "data-on": value === c,
    style: {
      background: c.startsWith('--') ? 'var(' + c + ')' : c
    },
    title: c,
    "aria-label": c,
    onClick: () => onChange && onChange(c)
  });
  if (compact) return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      ...style
    }
  }, GROUPS[2][1].map(c => /*#__PURE__*/React.createElement(Sw, {
    key: c,
    c: c
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style
    }
  }, GROUPS.map(([label, cs]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-metadata)',
      letterSpacing: 'var(--tracking-metadata)',
      textTransform: 'uppercase',
      color: 'var(--ink-muted)',
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, cs.map((c, i) => /*#__PURE__*/React.createElement(Sw, {
    key: i,
    c: c,
    round: label === 'Ink'
  }))))), recent.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-metadata)',
      letterSpacing: 'var(--tracking-metadata)',
      textTransform: 'uppercase',
      color: 'var(--ink-muted)',
      marginBottom: 4
    }
  }, "Recent"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, recent.map((c, i) => /*#__PURE__*/React.createElement(Sw, {
    key: i,
    c: c
  })))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      font: 'var(--text-caption)',
      color: 'var(--ink-secondary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    style: {
      width: 18,
      height: 18,
      padding: 0,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-subtle)',
      background: 'none'
    },
    onChange: e => onChange && onChange(e.target.value)
  }), "Custom\u2026"));
}
Object.assign(__ds_scope, { ColorPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ColorPicker.jsx", error: String((e && e.message) || e) }); }

// components/forms/DatePicker.jsx
try { (() => {
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
function DatePicker({
  month = 'September',
  year = 2026,
  selected = 15,
  rangeEnd,
  today = 15,
  shortcuts = ['Today', 'Tomorrow', 'Next Friday', 'In two weeks'],
  onSelect,
  startWeekday = 1,
  daysInMonth = 30,
  style
}) {
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const inRange = d => rangeEnd && d > selected && d < rangeEnd;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 224,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 15px/1 var(--font-calendar)'
    }
  }, month, " ", year), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    style: {
      width: 20,
      height: 20
    },
    "aria-label": "Previous month"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-left",
    size: 12
  })), /*#__PURE__*/React.createElement("button", {
    className: "db-tool",
    style: {
      width: 20,
      height: 20
    },
    "aria-label": "Next month"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 12
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2,
      font: 'var(--text-metadata)',
      color: 'var(--ink-muted)',
      textAlign: 'center',
      marginBottom: 2
    }
  }, DAYS.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2
    }
  }, cells.map((d, i) => {
    const sel = d === selected || d === rangeEnd;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => d && onSelect && onSelect(d),
      style: {
        height: 24,
        border: 'none',
        cursor: d ? 'pointer' : 'default',
        borderRadius: 'var(--radius-subtle)',
        font: 'var(--text-numeral-sm)',
        fontFeatureSettings: 'var(--numeral-features)',
        background: sel ? 'var(--accent)' : inRange(d) ? 'var(--accent-soft)' : 'transparent',
        color: sel ? 'var(--ink-inverse)' : d === today ? 'var(--accent)' : 'var(--ink-primary)',
        fontWeight: d === today ? 600 : 500,
        visibility: d ? 'visible' : 'hidden'
      }
    }, d);
  })), shortcuts.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 8,
      paddingTop: 8,
      borderTop: '1px solid var(--divider)'
    }
  }, shortcuts.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    className: "db-btn db-btn--sm db-btn--subtle"
  }, s))));
}
function TimeField({
  value = '09:30',
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("input", {
    className: "db-input",
    type: "time",
    value: value,
    onChange: onChange,
    style: {
      width: 86,
      fontFeatureSettings: 'var(--numeral-features)',
      ...style
    }
  });
}
Object.assign(__ds_scope, { DatePicker, TimeField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DatePicker.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function Field({
  label,
  help,
  invalid,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-field",
    style: style
  }, /*#__PURE__*/React.createElement("label", null, label), children, help && /*#__PURE__*/React.createElement("span", {
    className: "db-help",
    "data-invalid": !!invalid
  }, help));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  value,
  defaultValue,
  placeholder,
  invalid,
  disabled,
  onChange,
  type = 'text',
  style
}) {
  return /*#__PURE__*/React.createElement("input", {
    type: type,
    className: "db-input",
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    "data-invalid": !!invalid,
    disabled: disabled,
    onChange: onChange,
    style: style
  });
}
function TextArea({
  value,
  defaultValue,
  placeholder,
  rows = 3,
  disabled,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("textarea", {
    className: "db-input",
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    rows: rows,
    disabled: disabled,
    onChange: onChange,
    style: style
  });
}
Object.assign(__ds_scope, { Input, TextArea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/NumberField.jsx
try { (() => {
function NumberField({
  value,
  defaultValue,
  unit,
  min,
  max,
  step = 1,
  onChange,
  style
}) {
  const [v, setV] = React.useState(defaultValue ?? value ?? 0);
  const cur = Number(value ?? v);
  const set = n => {
    setV(n);
    onChange && onChange(n);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "db-numfield",
    style: style
  }, /*#__PURE__*/React.createElement("input", {
    value: cur,
    onChange: e => set(e.target.value),
    inputMode: "numeric"
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "db-num-unit"
  }, unit), /*#__PURE__*/React.createElement("span", {
    className: "db-num-steps"
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": "Increase",
    onClick: () => set(Math.min(max ?? Infinity, cur + step))
  }, "\u25B2"), /*#__PURE__*/React.createElement("button", {
    "aria-label": "Decrease",
    onClick: () => set(Math.max(min ?? -Infinity, cur - step))
  }, "\u25BC")));
}
Object.assign(__ds_scope, { NumberField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/NumberField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  label,
  name,
  checked,
  defaultChecked,
  disabled,
  onChange
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "db-radiobox"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: name,
    checked: checked,
    defaultChecked: defaultChecked,
    disabled: disabled,
    onChange: onChange
  }), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function SearchField({
  value,
  placeholder = 'Search…',
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-search",
    style: style
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 13
  }), /*#__PURE__*/React.createElement("input", {
    className: "db-input",
    value: value,
    placeholder: placeholder,
    onChange: onChange,
    type: "search",
    "aria-label": "Search"
  }));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
function SegmentedControl({
  options = [],
  value,
  defaultValue,
  onChange,
  style
}) {
  const [v, setV] = React.useState(defaultValue ?? value);
  const cur = value ?? v;
  return /*#__PURE__*/React.createElement("div", {
    className: "db-seg",
    role: "radiogroup",
    style: style
  }, options.map((o, i) => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      "data-on": cur === opt.value,
      role: "radio",
      "aria-checked": cur === opt.value,
      onClick: () => {
        setV(opt.value);
        onChange && onChange(opt.value);
      }
    }, opt.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: opt.icon,
      size: 12
    }), opt.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  options = [],
  value,
  defaultValue,
  onChange,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-select",
    style: style
  }, /*#__PURE__*/React.createElement("select", {
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    disabled: disabled
  }, options.map((o, i) => {
    const v = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: i,
      value: v.value
    }, v.label);
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Slider.jsx
try { (() => {
function Slider({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
  showValue = true,
  style
}) {
  const [v, setV] = React.useState(defaultValue ?? value ?? min);
  return /*#__PURE__*/React.createElement("div", {
    className: "db-slider",
    style: style
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value ?? v,
    onChange: e => {
      setV(e.target.value);
      onChange && onChange(e);
    }
  }), showValue && /*#__PURE__*/React.createElement("span", {
    className: "db-slider-val"
  }, value ?? v, unit));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Slider.jsx", error: String((e && e.message) || e) }); }

// components/forms/Toggle.jsx
try { (() => {
function Toggle({
  label,
  checked,
  defaultChecked,
  disabled,
  onChange
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "db-toggle"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    role: "switch",
    checked: checked,
    defaultChecked: defaultChecked,
    disabled: disabled,
    onChange: onChange
  }), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/overlays/CommandPalette.jsx
try { (() => {
// groups: [{label, items:[{icon,label,meta,shortcut,selected}]}]
function CommandPalette({
  query,
  placeholder = 'Type a command, date, or search…',
  groups = [],
  onQueryChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-palette",
    role: "dialog",
    "aria-label": "Command palette",
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-palette-input"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "command",
    size: 15
  }), /*#__PURE__*/React.createElement("input", {
    value: query,
    placeholder: placeholder,
    onChange: e => onQueryChange && onQueryChange(e.target.value),
    autoFocus: true
  }), /*#__PURE__*/React.createElement(__ds_scope.Kbd, {
    keys: ['⎋']
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 320,
      overflowY: 'auto',
      paddingBottom: 6
    }
  }, groups.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, g.label && /*#__PURE__*/React.createElement("div", {
    className: "db-palette-group"
  }, g.label), g.items.map((it, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    className: "db-palette-item",
    "data-sel": !!it.selected
  }, it.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: it.icon
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16
    }
  }), /*#__PURE__*/React.createElement("span", null, it.label), it.meta && /*#__PURE__*/React.createElement("span", {
    className: "db-pal-meta"
  }, it.meta), /*#__PURE__*/React.createElement("span", {
    className: "db-grow"
  }), it.shortcut && /*#__PURE__*/React.createElement(__ds_scope.Kbd, {
    keys: it.shortcut
  })))))));
}
Object.assign(__ds_scope, { CommandPalette });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/CommandPalette.jsx", error: String((e && e.message) || e) }); }

// components/overlays/ContextMenu.jsx
try { (() => {
// items: {label, icon?, shortcut?(string[]), danger?, disabled?, children?(sub items)} | {type:'separator'}
function ContextMenu({
  items,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-menu",
    role: "menu",
    style: style
  }, items.map((it, i) => {
    if (it.type === 'separator') return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "db-menu-sep",
      role: "separator"
    });
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: 'db-menu-item' + (it.danger ? ' db-menu-item--danger' : ''),
      "data-disabled": !!it.disabled,
      role: "menuitem",
      "aria-disabled": !!it.disabled
    }, it.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 14
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14
      }
    }), /*#__PURE__*/React.createElement("span", null, it.label), /*#__PURE__*/React.createElement("span", {
      className: "db-grow"
    }), it.shortcut && /*#__PURE__*/React.createElement("span", {
      className: "db-menu-short"
    }, /*#__PURE__*/React.createElement(__ds_scope.Kbd, {
      keys: it.shortcut
    })), it.children && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-right",
      size: 12
    }), it.children && /*#__PURE__*/React.createElement("div", {
      className: "db-menu-sub"
    }, /*#__PURE__*/React.createElement(ContextMenu, {
      items: it.children
    })));
  }));
}
Object.assign(__ds_scope, { ContextMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/ContextMenu.jsx", error: String((e && e.message) || e) }); }

// components/overlays/InspectorPanel.jsx
try { (() => {
function InspectorPanel({
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-inspector",
    style: style
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      font: 'var(--text-subheading)',
      borderBottom: '1px solid var(--divider)'
    }
  }, title), children);
}
function InspectorGroup({
  label,
  collapsed,
  children
}) {
  const [open, setOpen] = React.useState(!collapsed);
  return /*#__PURE__*/React.createElement("div", {
    className: "db-igroup"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-igroup-head",
    onClick: () => setOpen(!open),
    role: "button",
    "aria-expanded": open
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: open ? 'chevron-down' : 'chevron-right',
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, label)), open && /*#__PURE__*/React.createElement("div", {
    className: "db-igroup-body"
  }, children));
}
function InspectorRow({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-irow"
  }, /*#__PURE__*/React.createElement("label", null, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, children));
}
Object.assign(__ds_scope, { InspectorPanel, InspectorGroup, InspectorRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/InspectorPanel.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Modal.jsx
try { (() => {
function Modal({
  title,
  children,
  footer,
  onClose,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-modal-scrim"
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-modal",
    role: "dialog",
    "aria-modal": "true",
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-modal-head"
  }, /*#__PURE__*/React.createElement("span", null, title), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    iconOnly: true,
    icon: "x",
    variant: "ghost",
    size: "sm",
    title: "Close",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    className: "db-modal-body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "db-modal-foot"
  }, footer)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Modal.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Popover.jsx
try { (() => {
function Popover({
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "db-popover",
    role: "dialog",
    style: style
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "db-popover-title"
  }, title), children);
}
Object.assign(__ds_scope, { Popover });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Popover.jsx", error: String((e && e.message) || e) }); }

__ds_ns.CalendarCell = __ds_scope.CalendarCell;

__ds_ns.DateNavigator = __ds_scope.DateNavigator;

__ds_ns.DateNumber = __ds_scope.DateNumber;

__ds_ns.LayerPanel = __ds_scope.LayerPanel;

__ds_ns.MonthHeader = __ds_scope.MonthHeader;

__ds_ns.RangeBar = __ds_scope.RangeBar;

__ds_ns.WeekHeader = __ds_scope.WeekHeader;

__ds_ns.ZoomControl = __ds_scope.ZoomControl;

__ds_ns.EventObject = __ds_scope.EventObject;

__ds_ns.FileAttachment = __ds_scope.FileAttachment;

__ds_ns.Highlight = __ds_scope.Highlight;

__ds_ns.ImageObject = __ds_scope.ImageObject;

__ds_ns.SelectionBox = __ds_scope.SelectionBox;

__ds_ns.StickyNote = __ds_scope.StickyNote;

__ds_ns.TaskObject = __ds_scope.TaskObject;

__ds_ns.TextObject = __ds_scope.TextObject;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.ToolButton = __ds_scope.ToolButton;

__ds_ns.Toolbar = __ds_scope.Toolbar;

__ds_ns.ToolbarDivider = __ds_scope.ToolbarDivider;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.ColorPicker = __ds_scope.ColorPicker;

__ds_ns.DatePicker = __ds_scope.DatePicker;

__ds_ns.TimeField = __ds_scope.TimeField;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.TextArea = __ds_scope.TextArea;

__ds_ns.NumberField = __ds_scope.NumberField;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.CommandPalette = __ds_scope.CommandPalette;

__ds_ns.ContextMenu = __ds_scope.ContextMenu;

__ds_ns.InspectorPanel = __ds_scope.InspectorPanel;

__ds_ns.InspectorGroup = __ds_scope.InspectorGroup;

__ds_ns.InspectorRow = __ds_scope.InspectorRow;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Popover = __ds_scope.Popover;

})();
