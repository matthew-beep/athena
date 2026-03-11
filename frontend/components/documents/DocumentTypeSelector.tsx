interface DocumentTypeSelectorProps {
    docTypes: string[];
    onSelectDocType: (docType: string) => void;
    tab: string;
}

export function DocumentTypeSelector({ docTypes, onSelectDocType, tab }: DocumentTypeSelectorProps) {
  return (
    <div className="flex gap-2 tabs w-fit">
        {docTypes.map((docType) => (
        <button key={docType} className={`tab ${tab===docType?"on":""}`} onClick={() => onSelectDocType(docType)}>
            {docType}
        </button>
        ))}
    </div>
  );
}