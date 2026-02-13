// Simplified version for Step 1
import { Folder } from "lucide-react";

export function FolderTree() {
    return (
        <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 overflow-y-auto">
            <div className="flex items-center gap-2 text-gray-500 italic">
                <Folder className="w-4 h-4" />
                <span>Arborescence détaillée disponible après scan complet...</span>
            </div>
            {/* 
        In a real implementation, this would recursively list folders 
        based on the 'scan-folder' deep result 
      */}
        </div>
    );
}
