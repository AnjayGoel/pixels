import { COLORS, COLOR_HEX_MAP } from '../constants/colors';

interface ColorPickerProps {
    selectedColor: number | null;
    onColorSelect: (color: number) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect }) => {
    const handleClick = (colorCode: number) => {
        onColorSelect(colorCode);
    };

    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-lg shadow-lg">
            <div className="flex flex-wrap justify-center gap-1 max-w-[300px] sm:max-w-[500px]">
                {Object.entries(COLORS).map(([name, colorCode]) => (
                    <button
                        key={colorCode}
                        className={`w-8 h-8 sm:w-7 sm:h-7 rounded-md transition-all ${
                            selectedColor === colorCode
                                ? 'scale-105'
                                : 'hover:scale-105'
                        }`}
                        style={{
                            backgroundColor: COLOR_HEX_MAP[colorCode],
                            opacity: selectedColor === null ? 1 : (selectedColor === colorCode ? 1 : 0.7),
                            border: '1px solid #e5e5e5',
                            outline: selectedColor === colorCode ? '2px solid #000' : 'none'
                        }}
                        onClick={() => handleClick(colorCode)}
                        title={name}
                    />
                ))}
            </div>
        </div>
    );
}; 