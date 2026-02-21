import React from "react";
import "./PoiSide.scss";
import Textarea from "@/components/Input/TextArea/Textarea";

type Props = {
    coords?: { lat: number; lon: number } | null;
    editing: boolean;
    canEdit: boolean;

    descInput: string;
    setDescInput: (v: string) => void;
    description: string;

};

export default function PoiSide({
                                    coords,
                                    editing,
                                    canEdit,
                                    descInput,
                                    setDescInput,
                                    description,
                                }: Props) {
    const href = coords
        ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`
        : `https://www.google.com/maps/`;

    return (
        <>
            <a className="btn-directions" href={href} target="_blank" rel="noreferrer">
                Direcções
            </a>

            {editing && canEdit ? (
                <>
                    <label className="poi-edit-label">Descrição</label>
                    <Textarea
                        className="poi-edit-textarea"
                        rows={10}
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        variant="panel"
                    />
                </>
            ) : (
                <p className="poi-desc">{description}</p>
            )}
        </>
    );
}