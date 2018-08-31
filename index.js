import { LitElement, html } from 'https://unpkg.com/@polymer/lit-element@latest/lit-element.js?module'
import 'https://unpkg.com/ace-builds/src-noconflict/ace.js?module'
import 'https://unpkg.com/ace-builds/src-noconflict/ext-language_tools.js?module';
import 'https://unpkg.com/ace-builds/src-noconflict/snippets/snippets.js?module';
import dedent from './dedent.js'

class AceEditor extends LitElement {
  
  static get properties() {
    
    // AceEditor properties from editor.$options
    return {
      alt: Boolean,
      indent: Boolean,
      baseurl: String,
      wrap: Boolean,
      theme: String,
      mode: String,
      readonly: Boolean,
      softtabs: Boolean,
      fontSize: Number,
      tabSize: Number,
      snippets: String,
      autocomplete: Object,
      minLines: Number,
      maxLines: Number,
      enableBasicAutocompletion: Boolean,
      enableLiveAutocompletion: Boolean,
      enableSnippets: Boolean,
      initialFocus: Boolean,
      placeholder: String,
    }
  }
  
  constructor() {
    super();
    this.options = {};
    this.alt = false;
    this.indent = false;
    this.theme = 'github';
    this.mode = 'text';
    this.wrap = false;
    this.readonly = false;
    this.softtabs = true;
    this.fontSize = 14;
    this.tabSize = 4;
    // this.snippets = '';
    // this.autocomplete = {};
    // this.minLines = 15;
    // this.maxLines = 30;
    this.enableBasicAutocompletion = true;
    this.enableLiveAutocompletion = false;
    this.enableSnippets = false;
    this.initialFocus = false;
    this.placeholder = '';
    this.baseurl = 'https://unpkg.com/ace-builds/src-noconflict';
  }
  
  async _firstRendered() {
    // In non-minified mode, imports are parallelized, and sometimes `ext-language_tools.js` and`snippets.js` arrive before `ace.js` is ready. I am adding some tests here with dynamic imports to fix that
    !ace && await import(`${this.baseurl}/ace.js`)
    !ace.require("ace/ext/language_tools") && await import(`${this.baseurl}/ext-language_tools.js`)
    
    this.prepare(ace.edit(this._root.getElementById('editor')));
  }
  
  prepare(editor) {
    
    let {
      alt,
      baseurl,
      initialFocus,
      enableSnippets,
      enableBasicAutocompletion,
      enableLiveAutocompletion,
      autocomplete,
      minLines,
      maxLines,
      theme,
      placeholder,
    } = this;
    
    this.editor = editor;
    
    editor.focus = () => {
      setTimeout(() => !editor.isFocused() && editor.textInput.focus())
      editor.textInput.$focusScroll = "browser"
      editor.textInput.focus();
    };

    this.dispatchEvent(new CustomEvent('ready', { detail: { editor }}));
    this.injectStyle('#ace_editor\\.css');

    ['base', 'mode', 'theme', 'worker']
      .map(name => ace.config.set(`${name}Path`, baseurl))
    
    editor.on('change', (event, editor) => this.dispatchEvent(new CustomEvent('change', {
      detail: { value: editor.getValue() }
    })))
    
    editor.on('input', () => this.input(editor, placeholder));
    setTimeout(() => this.input(editor, placeholder), 100);
    
    initialFocus && editor.focus()

    editor.$blockScrolling = Infinity;

    // editor.setTheme(`ace/theme/${theme}`);

    // Forcing a xyzChanged() call, because the initial one din't do anything as editor wasn't created yet
    // this.readonlyChanged();
    // this.tabSizeChanged();
    // this.modeChanged();
    // this.softtabsChanged();
    // this.fontSizeChanged();
    
    // this.themeChanged();

    editor.setOptions({
      enableSnippets,
      enableBasicAutocompletion,
      enableLiveAutocompletion,
      minLines,
      maxLines,
//       lineNumbers: true,
//       viewportMargin: Infinity,
      firstLineNumber: 0,
//       fixedGutter: false,
      // selectionStyle: "line",
    })
    
    // snippets
    let snippetManager = ace.require('ace/snippets').snippetManager
    this.registerSnippets = snippetManager.register.bind(snippetManager);
    // enableSnippets && ace.require('ace/snippets').snippetManager.register(snippets, 'javascript');
    
    // autocomplete
    ace.require('ace/ext/language_tools').addCompleter({
      getCompletions: (editor, session, pos, prefix, callback) =>
        callback(null, (prefix.length === 0) ? [] : (autocomplete || [])),
    });
    
    alt && this.swapAlt(alt)
  }
  
  get value() {
    return this.editor ?
      this.editor.getValue() :
      this.options.value
  }
  
  set value(value) {
    this.editor ?
      this.editor.setValue(value) :
      this.options = { ...this.options, value }
  }
  
  swapAlt() {
    // Tell ace that the alt key is held down for mousedown events
    // This makes it so blockselection is always on
    // It also allows block selection on chromebooks
    this.editor._eventRegistry.mousedown[1] = (func => e => func({
      ...e, ...e.__proto__,
      getButton: () => e.getButton(),
      domEvent: { ...e.domEvent,
        altKey: !e.domEvent.altKey,
        shiftKey: e.domEvent.shiftKey,
        ctrlKey: e.domEvent.ctrlKey,
      },
    }))(this.editor._eventRegistry.mousedown[1])
  }

  _render(props, controls) {

    let {
      indent,
    } = props || {
      indent: false
    };
    
    return html`
      <style>
        :host {
          display: block;
          height: 240px;
        }
        #editor {
          border: 1px solid #e3e3e3;
          border-radius: 4px;
          @apply --ace-editor;
          height: 100%;
          width: 100%;
        }
      </style>
      <div id="editor">${indent ? this.textContent : dedent`${this.textContent}`}</div>
    `;
  }
  
  addCommands(commands, editor) {
    commands.map(({ name, ...command }) => {
      this.editor.commands.addCommand({
        ...(this.editor.commands.commands[name] || { name }),
        ...command,
      })
    })
  }
  
  /**
   * Injects a style element into ace-widget's shadow root
   * @param {CSSSelector} selector for an element in the same shadow tree or document as `ace-widget`
   */
  injectStyle(selector){
    const lightStyle = this.getRootNode().querySelector(selector) || document.querySelector(selector);
    this.shadowRoot.appendChild(lightStyle.cloneNode(true));
  }
  
  readonlyChanged() {
    let { editor, readonly } = this;
    editor.setReadOnly(readonly);
    editor.setHighlightActiveLine(!readonly);
    editor.setHighlightGutterLine(!readonly);
    editor.renderer.$cursorLayer.element.style.opacity = readonly ? 0 : 1;
  }

  get wrap() {
    const { editor, options } = this;
    return editor ? editor.getOption('wrap') : options.wrap
  }
  
  set wrap(wrap) {
    const { editor, options } = this;
    editor ?
      editor.setOption('wrap', wrap) :
      this.options = { ...options, wrap }
  }
  
  get tabSize() {
    const { editor, options } = this;
    return editor ? editor.getOption('tabSize') : options.tabSize
  }
  
  set tabSize(tabSize) {
    const { editor, options } = this;
    editor ?
      editor.setOption('tabSize', tabSize) :
      this.options = { ...options, tabSize }
  }
  
  // get fontSize() {
  //   const { editor, options } = this;
  //   return editor ? editor.getOption('wrap') : options.wrap
  // }
  
  // set fontSize(fontSize) {
  //   const { editor, options } = this;
  //   editor ?
  //     editor.setOption('wrap', wrap) :
  //     this.options = { ...options, wrap }
  // }
  
  fontSizeChanged() {
    let { editor, fontSize } = this;
    this._root.getElementById('editor').style.fontSize = `${fontSize}px`
  }
  
  get mode() {
    const { editor, options } = this;
    return editor ? editor.getOption('mode') : options.mode
  }
  
  set mode(mode) {
    const { editor, options } = this;
    editor ?
      editor.setOption('mode', `ace/mode/${mode}`) :
      this.options = { ...options, mode }
  }
  
  get theme() {
    const { editor, options } = this;
    return editor ? editor.getOption('theme') : options.theme
  }
  
  set theme(theme) {
    const { editor, options } = this;
    editor ?
      editor.setOption('theme', `ace/theme/${theme}`) :
      this.options = { ...options, theme }
  }
  
  get softTabs() {
    const { editor, options } = this;
    return editor ? editor.getOption('softTabs') : options.softTabs
  }
  
  set softTabs(softTabs) {
    const { editor, options } = this;
    editor ?
      editor.setOption('theme', softTabs) :
      this.options = { ...options, softTabs }
  }
  
  focus() {
    let { editor } = this;
    editor.focus()
  }

  input(editor, placeholder) {
    let shouldShow = !editor.getSession().getValue().length;
    let node = editor.renderer.emptyMessageNode;
    if (!shouldShow && node) {
        editor.renderer.scroller.removeChild(editor.renderer.emptyMessageNode);
        editor.renderer.emptyMessageNode = null;
    } else if (shouldShow && !node) {
        node = editor.renderer.emptyMessageNode = document.createElement('div');
        node.textContent = placeholder;
        node.className = 'ace_comment';
        node.style.padding = '0 9px';
        node.style.zIndex = '1';
        node.style.position = 'absolute';
        node.style.color = '#aaa';
        editor.renderer.scroller.appendChild(node);
    }
  }
  
}

customElements.define('ace-editor', AceEditor);

export default AceEditor;