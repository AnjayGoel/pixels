import { COLORS, COLOR_HEX_MAP } from '../constants/colors';

interface ColorPickerProps {
    selectedColor: number;
    onColorSelect: (color: number) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
                {Object.entries(COLORS).map(([name, colorCode]) => (
                    <button
                        key={colorCode}
                        className={`w-8 h-8 rounded-lg border-2 ${
                            selectedColor === colorCode ? 'border-black' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: COLOR_HEX_MAP[colorCode] }}
                        onClick={() => onColorSelect(colorCode)}
                        title={name}
                    />
                ))}
            </div>
        </div>
    );
}; 