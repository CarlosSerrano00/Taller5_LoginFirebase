/**
 * Sacudida horizontal para señalar que un formulario falló.
 *
 * Se usa react-native-reanimated (no Animated de React Native):
 *   - useSharedValue guarda el desplazamiento actual.
 *   - withSequence + withTiming encadenan los vaivenes y vuelven a 0.
 *   - useAnimatedStyle traduce ese valor a un transform en el hilo de UI.
 *
 * El componente no decide cuándo hay error: la pantalla incrementa `disparo`
 * cada vez que quiere que el bloque se sacuda. Usar un contador (y no un
 * booleano) permite repetir la animación en errores consecutivos.
 */
import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Cambia este número para disparar la animación. 0 = estado inicial. */
  disparo: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Píxeles que se mueve a cada lado. Suficiente para notarse sin romper el layout. */
const AMPLITUD = 18;
/** Duración de cada tramo del vaivén, en milisegundos. */
const TRAMO = 70;

export function Sacudida({ disparo, children, style }: Props) {
  const desplazamiento = useSharedValue(0);

  useEffect(() => {
    if (disparo === 0) return;

    desplazamiento.value = withSequence(
      withTiming(-AMPLITUD, { duration: TRAMO }),
      withTiming(AMPLITUD, { duration: TRAMO }),
      withTiming(-AMPLITUD * 0.6, { duration: TRAMO }),
      withTiming(AMPLITUD * 0.6, { duration: TRAMO }),
      withTiming(0, { duration: TRAMO }),
    );
  }, [disparo, desplazamiento]);

  const estiloAnimado = useAnimatedStyle(() => ({
    transform: [{ translateX: desplazamiento.value }],
  }));

  return <Animated.View style={[style, estiloAnimado]}>{children}</Animated.View>;
}
