import { COLORS, COLOR_HEX_MAP } from '../constants/colors';

interface ColorPickerProps {
    selectedColor: number | null;
    onColorSelect: (color: number) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect }) => {
    const handleClick = (colorCode: number) => {
        console.log('Current selected color:', selectedColor);
        console.log('Clicked color:', colorCode);
        console.log('Are they equal?', selectedColor === colorCode);
        onColorSelect(colorCode);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
                {Object.entries(COLORS).map(([name, colorCode]) => (
                    <button
                        key={colorCode}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            selectedColor === colorCode 
                                ? 'border-black scale-110 shadow-lg' 
                                : 'border-gray-200 hover:scale-105'
                        }`}
                        style={{ 
                            backgroundColor: COLOR_HEX_MAP[colorCode],
                            opacity: selectedColor === null ? 1 : (selectedColor === colorCode ? 1 : 0.7)
                        }}
                        onClick={() => handleClick(colorCode)}
                        title={name}
                    />
                ))}
            </div>
        </div>
    );
}; 