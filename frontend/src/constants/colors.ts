export const COLORS = {
    // Grayscale
    WHITE: 0,
    BLACK: 1,
    
    // Warm colors
    RED: 2,
    CRIMSON: 3,
    ORANGE: 4,
    YELLOW: 5,
    BROWN: 6,
    
    // Cool colors
    GREEN: 7,
    EMERALD: 8,
    CYAN: 9,
    TEAL: 10,
    BLUE: 11,
    NAVY: 12,
    
    // Purple/Pink family
    PURPLE: 13,
    PINK: 14,
    
    // Accent colors
    LIME: 15
};

export const COLOR_HEX_MAP: Record<number, string> = {
    // Grayscale
    0: '#FFFFFF', // White
    1: '#000000', // Black
    
    // Warm colors
    2: '#FF0000', // Red
    3: '#DC143C', // Crimson
    4: '#FF7F00', // Orange
    5: '#FFFF00', // Yellow
    6: '#8B4513', // Brown
    
    // Cool colors
    7: '#00FF00', // Green
    8: '#50C878', // Emerald
    9: '#00FFFF', // Cyan
    10: '#008080', // Teal
    11: '#0000FF', // Blue
    12: '#000080', // Navy
    
    // Purple/Pink family
    13: '#800080', // Purple
    14: '#FF00FF', // Pink
    
    // Accent colors
    15: '#BFFF00'  // Lime
};

// Create a sorted array of color IDs for the palette display
export const COLOR_ARRAY = [
    // Grayscale
    0, 1,
    
    // Warm colors
    2, 3, 4, 5, 6,
    
    // Cool colors
    7, 8, 9, 10, 11, 12,
    
    // Purple/Pink family
    13, 14,
    
    // Accent colors
    15
]; 