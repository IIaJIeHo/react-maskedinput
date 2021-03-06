import React from 'react'
import PropTypes from 'prop-types'
import InputMask from 'inputmask-core'

var KEYCODE_Z = 90
var KEYCODE_Y = 89

function isUndo(e) {
  return (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Y : KEYCODE_Z)
}

function isRedo(e) {
  return (e.ctrlKey || e.metaKey) && e.keyCode === (e.shiftKey ? KEYCODE_Z : KEYCODE_Y)
}

function getSelection (el) {
  var start, end, rangeEl, clone

  if (el.selectionStart !== undefined) {
    start = el.selectionStart
    end = el.selectionEnd
  }
  else {
    try {
      el.focus()
      rangeEl = el.createTextRange()
      clone = rangeEl.duplicate()

      rangeEl.moveToBookmark(document.selection.createRange().getBookmark())
      clone.setEndPoint('EndToStart', rangeEl)

      start = clone.text.length
      end = start + rangeEl.text.length
    }
    catch (e) { /* not focused or not visible */ }
  }

  return { start, end }
}

function setSelection(el, selection) {
  var rangeEl

  try {
    if (el.selectionStart !== undefined) {
      el.focus()
      el.setSelectionRange(selection.start, selection.end)
    }
    else {
      el.focus()
      rangeEl = el.createTextRange()
      rangeEl.collapse(true)
      rangeEl.moveStart('character', selection.start)
      rangeEl.moveEnd('character', selection.end - selection.start)
      rangeEl.select()
    }
  }
  catch (e) { /* not focused or not visible */ }
}

export class MaskedInput extends React.Component {
  constructor(props) {
    super(props)
  }

  componentWillMount() {
    var options = {
      pattern: this.props.mask,
      value: this.props.value,
      formatCharacters: this.props.formatCharacters
    }
    if (this.props.placeholderChar) {
      options.placeholderChar = this.props.placeholderChar
    }
    if (this.props.isRevealingMask) {
      options.isRevealingMask = this.props.isRevealingMask
    }
    this.mask = new InputMask(options)
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.mask !== nextProps.mask && this.props.value !== nextProps.mask) {
      // if we get a new value and a new mask at the same time
      // check if the mask.value is still the initial value
      // - if so use the nextProps value
      // - otherwise the `this.mask` has a value for us (most likely from paste action)
      if (this.mask.getValue() === this.mask.emptyValue) {
        this.mask.setPattern(nextProps.mask, {value: nextProps.value})
      }
      else {
        this.mask.setPattern(nextProps.mask, {value: this.mask.getRawValue()})
      }
    }
    else if (this.props.mask !== nextProps.mask) {
      this.mask.setPattern(nextProps.mask, {value: this.mask.getRawValue()})
    }
    else if (this.props.value !== nextProps.value) {
      this.mask.setValue(nextProps.value)
    }
  }

  componentWillUpdate(nextProps, nextState) {
    if (nextProps.mask !== this.props.mask) {
      this._updatePattern(nextProps)
    }
  }

  componentDidUpdate(prevProps) {
    if ((prevProps.mask !== this.props.mask && this.mask.selection.start)||(prevProps.value !== this.props.value)) {
      this._updateInputSelection()
    }
  }

  _updatePattern(props) {
    this.mask.setPattern(props.mask, {
      value: this.mask.getRawValue(),
      selection: getSelection(this.input)
    })
  }

  _updateMaskSelection() {
    this.mask.selection = getSelection(this.input)
  }

  _updateInputSelection() {
    setSelection(this.input, this.mask.selection)
  }

  _onChange(e) {
    // console.log('onChange', JSON.stringify(getSelection(this.input)), e.target.value)

    var maskValue = this.mask.getValue()
    if (e.target.value !== maskValue) {
      // Cut or delete operations will have shortened the value
      if (e.target.value.length < maskValue.length) {
        var sizeDiff = maskValue.length - e.target.value.length
        this._updateMaskSelection()
        this.mask.selection.end = this.mask.selection.start + sizeDiff
        this.mask.backspace()
      }
      var value = this._getDisplayValue()
      e.target.value = value
      if (value) {
        this._updateInputSelection()
      }
    }
    this._updateValue(e)
  }

  _onKeyDown(e) {
    // console.log('onKeyDown', JSON.stringify(getSelection(this.input)), e.key, e.target.value)

    if (isUndo(e)) {
      e.preventDefault()
      if (this.mask.undo()) {
        e.target.value = this._getDisplayValue()
        this._updateInputSelection()
        this._updateValue(e)
      }
      return
    }
    else if (isRedo(e)) {
      e.preventDefault()
      if (this.mask.redo()) {
        e.target.value = this._getDisplayValue()
        this._updateInputSelection()
        this._updateValue(e)
      }
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      this._updateMaskSelection()
      if (this.mask.backspace()) {
        var value = this._getDisplayValue()
        e.target.value = value
        if (value) {
          this._updateInputSelection()
        }
        this._updateValue(e)
      }
    }
  }

  _onKeyPress(e) {
    // console.log('onKeyPress', JSON.stringify(getSelection(this.input)), e.key, e.target.value)

    // Ignore modified key presses
    // Ignore enter key to allow form submission
    if (e.metaKey || e.altKey || e.ctrlKey || e.key === 'Enter') { return }

    e.preventDefault()
    this._updateMaskSelection()
    if (this.mask.input((e.key || e.data))) {
      e.target.value = this.mask.getValue()
      window.mask = this.mask
      this._updateInputSelection()
      this._updateValue(e)
    }
  }

  _onPaste(e) {
    // console.log('onPaste', JSON.stringify(getSelection(this.input)), e.clipboardData.getData('Text'), e.target.value)

    e.preventDefault()
    this._updateMaskSelection()
    // getData value needed for IE also works in FF & Chrome
    if (this.mask.paste(e.clipboardData.getData('Text'))) {
      e.target.value = this.mask.getValue()
      // Timeout needed for IE
      setTimeout(this._updateInputSelection, 0)
      this._updateValue(e)
    }
  }

  _updateValue(e) {
    this.mask.setValue(this.mask.getValue())
    if (this.props.onChange) {
      this.props.onChange(e, this.mask)
    }
  }

  _getDisplayValue() {
    var value = this.mask.getValue()
    return value === this.mask.emptyValue ? '' : value
  }

  _keyPressPropName() {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent.match(/Android/i)
      ? 'onBeforeInput'
      : 'onKeyPress'
    }
    return 'onKeyPress'
  }

  _getEventHandlers() {
    return {
      onChange: (e) => this._onChange(e),
      onKeyDown: (e) => this._onKeyDown(e),
      onPaste: (e) => this._onPaste(e),
      [this._keyPressPropName()]: (e) => this._onKeyPress(e)
    }
  }

  focus() {
    this.input.focus()
  }

  blur() {
    this.input.blur()
  }

  render() {
    let ref = r => { this.input = r }
    let maxLength = this.mask.pattern.length
    let value = this._getDisplayValue()
    let eventHandlers = this._getEventHandlers()
    let { size = maxLength, placeholder = this.mask.emptyValue } = this.props

    let {placeholderChar, formatCharacters, isRevealingMask, ...cleanedProps} = this.props
    let inputProps = { ...cleanedProps, ...eventHandlers, ref, maxLength, value, size, placeholder }
    return <input {...inputProps} />
  }
}

MaskedInput.propTypes = {
  mask: PropTypes.string.isRequired,
  formatCharacters: PropTypes.object,
  placeholderChar: PropTypes.string
}

MaskedInput.defaultProps = {
  value: ''
}

let styles = {
  maskedWrapper: {
    position: 'relative',
    width: '100%',
    display: 'inline-block'
  },
  maskedInput: {
    background: 'transparent',
    zIndex: '10'
  },
  maskedPlaceholder: {
    position: 'absolute',
    width: '100%',
    left: '0',
    top: '0',
    zIndex: '-1'
  },
  hide: {
    display: 'none'
  }
}


export class MaskedInputFixed extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      val: ''
    }
  }
  componentWillMount() {
    if (this.props.value) {
      this.setState({
        val: this.props.value
      })
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value) {
      this.setState({
        val: nextProps.value
      })
    }
  }

  _onChange(e, mask) {
    let val = mask.getRawValue()
    let placeholderChar = this.props.placeholderChar
    let arrVal = val.split(placeholderChar)
    let newRawVal = arrVal.join('')
    mask.setValue(newRawVal)
    let finalVal = mask.getValue()
    let newE = {
      ...e,
      target: {
        ...e.target,
        value: finalVal
      }
    }
    this.setState({
      val: finalVal
    })
    this.props.onChange(newE)
  }

  render() {
    let { showPlaceholder, placeholderFixed, hidePlaceholder, className = '', classWrapper = '', classPlaceholder = '', onChange, ...filteredProps } = this.props
    let { placeholderChar, isRevealingMask, ...filteredPropsforInput } = filteredProps
    let fixedPlaceholder = this.state.val.concat(placeholderFixed.slice(this.state.val.length))

    return <div className={classWrapper} style={styles.maskedWrapper} >
            <MaskedInput {...filteredProps}
                 onChange={(e, mask) => {
                   this._onChange(e, mask)
                 }}
                 value={this.state.val}
                 ref={(r) => this.input = r && r.input}
              className={className}
              style={styles.maskedInput} />
            <input { ...filteredPropsforInput }
                    value={ fixedPlaceholder }
                    style={hidePlaceholder ? {...styles.maskedPlaceholder, ...styles.hide} : styles.maskedPlaceholder}
                    className={classPlaceholder}
                    disabled />
          </div>
  }
}

MaskedInputFixed.defaultProps = {
  placeholderChar: ' ',
  isRevealingMask: true
}

class MaskedSwitch extends React.Component {
  render() {
    return (
      this.props.placeholderFixed
      ? <MaskedInputFixed {...this.props} ref={(r) => this.input = r && r.input} />
      : <MaskedInput {...this.props} ref={(r) => this.input = r && r.input} />
    )
  }
}

MaskedSwitch.propTypes = {
  mask: PropTypes.string.isRequired,
  formatCharacters: PropTypes.object,
  placeholderChar: PropTypes.string
}

export default MaskedSwitch
