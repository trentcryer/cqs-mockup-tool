import { useRef, useState } from 'react'
import { View, PanResponder, StyleSheet, type LayoutChangeEvent, type DimensionValue } from 'react-native'

// Pure-JS slider (View + PanResponder, no native module) so it runs in plain
// Expo Go without a custom dev client build.
interface SliderProps {
  minimumValue?: number
  maximumValue: number
  value: number
  onValueChange: (value: number) => void
  minimumTrackTintColor?: string
  maximumTrackTintColor?: string
}

const THUMB_SIZE = 22
const TRACK_HEIGHT = 4

export default function Slider({
  minimumValue = 0,
  maximumValue,
  value,
  onValueChange,
  minimumTrackTintColor = '#b8892a',
  maximumTrackTintColor = '#e0d8cf',
}: SliderProps) {
  const wrapRef = useRef<View>(null)
  const trackWidth = useRef(0)
  const trackPageX = useRef(0)
  const [measured, setMeasured] = useState(0)

  function onLayout(e: LayoutChangeEvent) {
    trackWidth.current = e.nativeEvent.layout.width
    setMeasured(e.nativeEvent.layout.width)
    // pageX is needed because locationX becomes unreliable once the touch
    // moves over a sibling (the thumb), which resets its reference frame.
    wrapRef.current?.measure((_x, _y, _w, _h, pageX) => {
      trackPageX.current = pageX
    })
  }

  function valueFromPageX(pageX: number) {
    const w = trackWidth.current
    if (w <= 0) return value
    const x = pageX - trackPageX.current
    const ratio = Math.min(1, Math.max(0, x / w))
    return minimumValue + ratio * (maximumValue - minimumValue)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => onValueChange(valueFromPageX(evt.nativeEvent.pageX)),
      onPanResponderMove: (evt) => onValueChange(valueFromPageX(evt.nativeEvent.pageX)),
    })
  ).current

  const ratio = measured > 0 ? (value - minimumValue) / (maximumValue - minimumValue) : 0
  const fillWidth = `${Math.min(1, Math.max(0, ratio)) * 100}%` as DimensionValue
  const thumbLeft = measured > 0 ? Math.min(measured - THUMB_SIZE, Math.max(0, ratio * measured - THUMB_SIZE / 2)) : 0

  return (
    <View ref={wrapRef} style={styles.wrap} onLayout={onLayout} {...panResponder.panHandlers}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: maximumTrackTintColor }]} />
      <View pointerEvents="none" style={[styles.fill, { width: fillWidth, backgroundColor: minimumTrackTintColor }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: thumbLeft, backgroundColor: minimumTrackTintColor }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 32, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, width: '100%' },
  fill: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, position: 'absolute' },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
})
