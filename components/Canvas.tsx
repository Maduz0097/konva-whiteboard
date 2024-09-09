import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuid } from "uuid";
import { Stage } from "react-konva";
import Toolbar from "./toolbar/Toolbar";
import InkLayer from "./ink/InkLayer";
import ShapesLayer from "./shapes/ShapesLayer";
import ConfirmationDialog from "./ConfirmationDialog";
import TextFieldsLayer from "./textFields/TextFieldsLayer";
import { RootState } from "../redux/store";
import {
  addCanvasObject,
  updateCanvasObject,
  deleteCanvasObject,
  selectCanvasObject,
  resetCanvas,
  undo,
  redo,
  setCanvasObjects,
} from "../redux/canvasSlice";
import { SHAPE_MIN_HEIGHT, SHAPE_MIN_WIDTH } from "./shapes/shapeUtils";
import { TEXT_MIN_HEIGHT, TEXT_MIN_WIDTH } from "./textFields/textFieldUtils";

export interface StageSizeType {
  width: number;
  height: number;
}

export interface CanvasObjectType {
  id: string;
  type: ObjectType;
  tool?: ToolType;
  shapeName?: ShapeName;
  stroke?: string; // stroke color
  strokeWidth?: number;
  fill?: string;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
}

export type ObjectType = "ink" | "shape" | "text";

export type ToolType =
  | "eraser"
  | "pen"
  | "addText"
  | "addOval"
  | "addRectangle";

export type ShapeName = "rectangle" | "oval";

export default function Canvas() {
  const dispatch = useDispatch();
  const [stageSize, setStageSize] = useState<StageSizeType>();
  const { canvasObjects, selectedObjectId } = useSelector(
    (state: RootState) => state.canvas,
  );

  const [selectedTool, setSelectedTool] = useState<ToolType>("pen");
  const [strokeColor, setStrokeColor] = useState<string>("#2986cc");
  const [strokeWidth, setStrokeWidth] = useState<number>(5);

  const [isInProgress, setIsInProgress] = useState(false);

  const [newObject, setNewObject] = useState<CanvasObjectType | null>(null); // new text/shape object to be added to the canvas

  const [open, setOpen] = useState(false); // confirmation modal for delete button - clear canvas

  // update cursor style
  useEffect(() => {
    const getCursorStyle = () => {
      switch (selectedTool) {
        case "pen":
          return `url(/mousePointer/add.svg) 12 12, crosshair`;
        case "addText":
          return `url(/mousePointer/text.svg) 12 12, text`;
        case "addRectangle":
          return `url(/mousePointer/rectangle.svg) 12 12, pointer`;
        case "addOval":
          return `url(/mousePointer/oval.svg) 12 12, pointer`;
        case "eraser":
          return `url(/mousePointer/erase.svg) 12 12, default`;
        default:
          return "default";
      }
    };

    const resetCursor = () => {
      document.body.style.cursor = getCursorStyle();
    };

    window.addEventListener("mouseleave", resetCursor);

    document.body.style.cursor = getCursorStyle();
    return () => {
      document.body.style.cursor = "default";
      window.removeEventListener("mouseleave", resetCursor);
    };
  }, [selectedTool]);

  // load from local storage
  useEffect(() => {
    const savedState = localStorage.getItem("canvasState");
    if (savedState) {
      const canvasObjects = JSON.parse(savedState);
      dispatch(setCanvasObjects(canvasObjects));
    }
  }, [dispatch]);

  // Save state to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("canvasState", JSON.stringify(canvasObjects));
  }, [canvasObjects]);

  const handleDelete = useCallback(() => {
    if (selectedObjectId === "") {
      if (canvasObjects.length > 0) {
        setOpen(true);
      }
    } else {
      dispatch(deleteCanvasObject(selectedObjectId));
    }
  }, [dispatch, selectedObjectId, canvasObjects]);

  const resetCanvasState = useCallback(() => {
    dispatch(resetCanvas());
  }, [dispatch]);

  // update browser window size
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Update the size on mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Delete" || // Del for Windows/Linux
        (event.metaKey && event.key === "Backspace") // Cmd+delete for macOS
      ) {
        handleDelete();
      } else if (
        (event.ctrlKey && event.key === "z") || // Ctrl+Z for Windows/Linux
        (event.metaKey && event.key === "z" && !event.shiftKey) // Cmd+Z for macOS
      ) {
        dispatch(undo());
      } else if (
        (event.ctrlKey && event.key === "y") || // Ctrl+Y for Windows/Linux
        (event.metaKey && event.shiftKey && event.key === "z") // Cmd+Shift+Z for macOS
      ) {
        dispatch(redo());
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDelete, dispatch]);

  // component has not finished loading the window size
  if (!stageSize) {
    return null;
  }

  function updateStyle(property: keyof CanvasObjectType, value: any) {
    // Dynamically update state
    if (property === "strokeWidth") {
      setStrokeWidth(value);
    } else if (property === "stroke") {
      setStrokeColor(value);
    }

    // Update object property
    if (selectedObjectId !== "") {
      dispatch(
        updateCanvasObject({
          id: selectedObjectId,
          updates: { [property]: value },
        }),
      );
    }
  }

  function updateSelectedObject(
    newAttrs: Partial<CanvasObjectType>,
    selectedObjectId: string,
  ) {
    dispatch(updateCanvasObject({ id: selectedObjectId, updates: newAttrs }));
  }

  const addTextField = (x: number, y: number) => {
    const newObjectId = uuid();
    let newObject: CanvasObjectType = {
      id: newObjectId,
      type: "text" as const,
      x: x,
      y: y,
      width: TEXT_MIN_WIDTH,
      height: TEXT_MIN_HEIGHT,
      fill: strokeColor, // use strokeColor for fill for now
      // strokeWidth not applied to text field for now
      text: "Double click to edit.",
      fontSize: 28,
      fontFamily: "Arial",
    };

    setNewObject(newObject);
    dispatch(selectCanvasObject(newObjectId));
  };

  const addShape = (shapeName: ShapeName, x: number, y: number) => {
    const newShapeId = uuid();
    const baseShape = {
      id: newShapeId,
      shapeName,
      type: "shape" as const,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      x: x,
      y: y,
      width: SHAPE_MIN_WIDTH,
      height: SHAPE_MIN_HEIGHT,
    }; // common shape properties

    let newShape: CanvasObjectType;
    switch (shapeName) {
      case "rectangle":
        newShape = {
          ...baseShape,
        };
        break;
      case "oval":
        newShape = {
          ...baseShape,
        };
        break;
      default:
        console.warn(`Unknown shapeName: ${shapeName}`);
        return;
    }

    setNewObject(newShape);
    dispatch(selectCanvasObject(newShapeId));
  };

  const handleMouseDown = (e: any) => {
    // Drawing/adding object shall begin only if no object is currently selected.
    if (!selectedObjectId) {
      // set in progress status
      setIsInProgress(true);

      // If the current selected tool is addText or add shapes
      if (selectedTool.includes("add")) {
        const pos = e.target.getStage().getPointerPosition();
        const { x, y } = pos;

        // Add new object based on tool
        switch (selectedTool) {
          case "addText":
            addTextField(x, y);
            break;
          case "addRectangle":
            addShape("rectangle", x, y);
            break;
          case "addOval":
            addShape("oval", x, y);
            break;
          default:
            console.warn(`Unknown tool: ${selectedTool}`);
            return;
        }
        return;
      }

      // If the current selected tool is eraser or pen
      const pos = e.target.getStage().getPointerPosition();
      const newLine: CanvasObjectType = {
        id: uuid(),
        tool: selectedTool, // eraser or pen
        type: "ink",
        points: [pos.x, pos.y],
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      };
      setNewObject(newLine);
      return;
    }

    // deselect object when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      dispatch(selectCanvasObject(""));
    }
  };

  const handleMouseMove = (e: any) => {
    // Creating new text/object is in progress
    if (isInProgress && newObject && newObject.type !== "ink") {
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();

      const width = Math.max(Math.abs(point.x - newObject.x!) || 5);
      const height = Math.max(Math.abs(point.y - newObject.y!) || 5);

      // Update new object based on mouse position
      if (selectedTool.includes("add")) {
        setNewObject({
          ...newObject,
          width,
          height,
        });
      } else {
        console.warn(`Unknown tool: ${selectedTool}`);
      }

      return;
    }

    // Freehand drawing (eraser or pen) in progress
    if (isInProgress && newObject) {
      const stage = e.target.getStage();
      const point = stage.getPointerPosition();

      const updatedObject = {
        ...newObject,
        points: newObject.points!.concat([point.x, point.y]),
      };

      setNewObject(updatedObject);
    }
  };

  const handleMouseUp = () => {
    // Add object to store upon releasing mouse
    if (isInProgress) {
      if (newObject) dispatch(addCanvasObject(newObject));

      setNewObject(null);
      setIsInProgress(false);
    }
  };

  return (
    <>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onTouchStart={handleMouseDown}
      >
        <InkLayer objects={canvasObjects} newObject={newObject} />
        <ShapesLayer
          objects={canvasObjects}
          newObject={newObject}
          onChange={updateSelectedObject}
          setColor={setStrokeColor}
          setWidth={setStrokeWidth}
          selectedObjectId={selectedObjectId}
          setSelectedObjectId={(newObjectId) =>
            dispatch(selectCanvasObject(newObjectId))
          }
        />
        <TextFieldsLayer
          objects={canvasObjects}
          newObject={newObject}
          selectedObjectId={selectedObjectId}
          setSelectedObjectId={(newObjectId) =>
            dispatch(selectCanvasObject(newObjectId))
          }
          onChange={updateSelectedObject}
        />
      </Stage>
      <Toolbar
        objects={canvasObjects}
        setTool={setSelectedTool}
        color={strokeColor}
        onSelectColor={(newColor) => updateStyle("stroke", newColor)}
        onDelete={handleDelete}
        strokeWidth={strokeWidth}
        setStrokeWidth={(newWidth) => updateStyle("strokeWidth", newWidth)}
      />
      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={resetCanvasState}
        title="Clear Canvas"
        description="Are you sure you want to clear the canvas? This action cannot be undone."
      />
    </>
  );
}
