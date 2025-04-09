import { IconButton, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import HomeIcon from '@mui/icons-material/Home';

interface ZoomControlsProps {
    scale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
    scale,
    onZoomIn,
    onZoomOut,
    onReset,
}) => {
    const scaleDisplay = scale < 10 ? scale.toFixed(1) + 'x' : Math.round(scale) + 'x';

    return (
        <Paper className="fixed top-4 right-4 p-2" elevation={3}>
            <IconButton onClick={onZoomIn} size="small">
                <AddIcon />
            </IconButton>

            <Typography variant="body2" className="select-none">
                {scaleDisplay}
            </Typography>

            <IconButton onClick={onZoomOut} size="small">
                <RemoveIcon />
            </IconButton>

            <IconButton onClick={onReset} size="small" className="mt-2">
                <HomeIcon />
            </IconButton>
        </Paper>
    );
}; 