import { Text } from 'react-native';
import { selectionHintTextStyle } from './styles';

interface SelectionHintProps {
  max: number;
}

export function SelectionHint({ max }: SelectionHintProps) {
  return <Text style={selectionHintTextStyle}>최대 {max}개 선택</Text>;
}
