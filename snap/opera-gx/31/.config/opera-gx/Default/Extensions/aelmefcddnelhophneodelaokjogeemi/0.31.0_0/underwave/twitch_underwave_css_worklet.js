const GxClipPath = (
    width,
    height,
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    ) => {
  const paths = [];
  paths.push(`m ${topLeft.getSize()} 0`);
  paths.push(`l ${width - topLeft.getSize() - topRight.getSize()} 0`);
  const topRightCorner = topRight.getPath();
  if (topRightCorner) {
    paths.push(topRightCorner);
  }
  paths.push(`l 0 ${height - topRight.getSize() - bottomRight.getSize()}`);
  const bottomRightCorner = bottomRight.getPath();
  if (bottomRightCorner) {
    paths.push(bottomRightCorner);
  }
  paths.push(`l ${-width + bottomRight.getSize() + bottomLeft.getSize()} 0`);
  const bottomLeftCorner = bottomLeft.getPath();
  if (bottomLeftCorner) {
    paths.push(bottomLeftCorner);
  }
  paths.push(`l 0 ${-height + bottomLeft.getSize() + topLeft.getSize()}`);
  const topLeftCorner = topLeft.getPath();
  if (topLeftCorner) {
    paths.push(topLeftCorner);
  }
  return `${paths.join(' ')}`;
};

const Shape = {
  Type: {
    STRAIGHT: 'straight',
    ROUNDED: 'rounded',
    TRIMMED: 'trimmed',
  },

  Trimmed: {
    S: 'gx-trim-s',
    M: 'gx-trim-m',
    L: 'gx-trim-l',
    XL: 'gx-trim-xl',
    XXL: 'gx-trim-xxl',
  },

  Rounded: {
    S: 'gx-radius-s',
    M: 'gx-radius-m',
    L: 'gx-radius-l',
  },
};

const Position = {
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right',
};

class Corner {
  constructor(position, shape, size) {
    this.position = position;
    this.shape = shape;
    this.size = size;
  }

  getRoundedSize() {
    switch (this.size) {
      case Shape.Rounded.S:
        return 2;
      case Shape.Rounded.M:
        return 4;
      case Shape.Rounded.L:
        return 8;
      default:
        return 8;
    }
  }

  getTrimmedSize() {
    switch (this.size) {
      case Shape.Trimmed.S:
        return 8;
      case Shape.Trimmed.M:
        return 16;
      case Shape.Trimmed.L:
        return 24;
      case Shape.Trimmed.XL:
        return 32;
      case Shape.Trimmed.XXL:
        return 48;
      default:
        return 16;
    }
  }

  getSize() {
    switch (this.shape) {
      case Shape.Type.STRAIGHT:
        return 0;
      case Shape.Type.ROUNDED:
        return this.getRoundedSize();
      case Shape.Type.TRIMMED:
        return this.getTrimmedSize();
    }
  }

  getPath() {
    switch (this.shape) {
      case Shape.Type.STRAIGHT: {
        return '';
      }

      case Shape.Type.ROUNDED: {
        const size = this.getRoundedSize();
        switch (this.position) {
          case Position.TOP_LEFT: {
            return `c 0 0 0 -${size} ${size} -${size}`;
          }
          case Position.TOP_RIGHT: {
            return `c 0 0 ${size} 0 ${size} ${size}`;
          }
          case Position.BOTTOM_RIGHT: {
            return `c 0 0 0 ${size} -${size} ${size}`;
          }
          case Position.BOTTOM_LEFT: {
            return `c 0 0 -${size} 0 -${size} -${size}`;
          }
        }
      }

      break;
      case Shape.Type.TRIMMED: {
        const size = this.getTrimmedSize();
        const line = (size * 5) / 8;
        const curve = size / 4;
        const bent = size / 8;
        switch (this.position) {
          case Position.TOP_LEFT: {
            return `c 0 -${bent} ${bent} -${curve} ${bent} -${curve} l ${
                line} -${line} c 0 0 ${bent} -${bent} ${curve} -${bent}`;
          }
          case Position.TOP_RIGHT: {
            return `c 0 0 ${bent} 0 ${curve} ${bent} l ${line} ${line} c 0 0 ${
                bent} ${bent} ${bent} ${curve}`;
          }
          case Position.BOTTOM_RIGHT: {
            return `c 0 ${bent} -${bent} ${curve} -${bent} ${curve} l -${
                line} ${line} c 0 0 -${bent} ${bent} -${curve} ${bent}`;
          }
          case Position.BOTTOM_LEFT: {
            return `c -${bent} 0 -${curve} -${bent} -${curve} -${bent} l -${
                line} -${line} c 0 0 -${bent} -${bent} -${bent} -${curve}`;
          }
        }
      }
    }
  }
}

const getShapeType = shape => {
  if (Object.values(Shape.Rounded).includes(shape)) {
    return Shape.Type.ROUNDED;
  }
  if (Object.values(Shape.Trimmed).includes(shape)) {
    return Shape.Type.TRIMMED;
  }
  return Shape.Type.STRAIGHT;
};

const resolveCorners = (cornerShape, cornerPosition, shapeSize) => {
  const cornerShapeMap = {
    0: Shape.Rounded[shapeSize || 'M'],
    1: Shape.Trimmed[shapeSize || 'M'],
  };

  const resolveCornerShape = shape =>
    Object.keys(cornerShapeMap).length < shape + 1 ? 0 : shape;

  /*
    0: top-left
    1: top-right
    2: bottom-right
    3: bottom-left
    4: all
  */
  const cornerShapePositionMap = {
    0: [
      cornerShapeMap[resolveCornerShape(cornerShape)],
      Shape.Rounded.M,
      Shape.Rounded.M,
      Shape.Rounded.M,
    ],
    1: [
      Shape.Rounded.M,
      cornerShapeMap[resolveCornerShape(cornerShape)],
      Shape.Rounded.M,
      Shape.Rounded.M,
    ],
    2: [
      Shape.Rounded.M,
      Shape.Rounded.M,
      cornerShapeMap[resolveCornerShape(cornerShape)],
      Shape.Rounded.M,
    ],
    3: [
      Shape.Rounded.M,
      Shape.Rounded.M,
      Shape.Rounded.M,
      cornerShapeMap[resolveCornerShape(cornerShape)],
    ],
    4: [
      cornerShapeMap[resolveCornerShape(cornerShape)],
      cornerShapeMap[resolveCornerShape(cornerShape)],
      cornerShapeMap[resolveCornerShape(cornerShape)],
      cornerShapeMap[resolveCornerShape(cornerShape)],
    ],
  };

  return cornerShapePositionMap[cornerPosition] || [];
};

const getNumberFactory = props => (propName, defaultValue) => {
  const value = Number(props.get(propName)[0]);

  return isNaN(value) ? defaultValue : value ?? defaultValue;
};

const UnderwaveClipPath = (
    width,
    height,
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
    ) => {
  const topLeftCorner = new Corner(
      Position.TOP_LEFT,
      getShapeType(topLeft),
      topLeft,
  );
  const topRightCorner = new Corner(
      Position.TOP_RIGHT,
      getShapeType(topRight),
      topRight,
  );
  const bottomRightCorner = new Corner(
      Position.BOTTOM_RIGHT,
      getShapeType(bottomRight),
      bottomRight,
  );
  const bottomLeftCorner = new Corner(
      Position.BOTTOM_LEFT,
      getShapeType(bottomLeft),
      bottomLeft,
  );
  return GxClipPath(
      width,
      height,
      topLeftCorner,
      topRightCorner,
      bottomRightCorner,
      bottomLeftCorner,
  );
};

class CardBackground {
  static get inputProperties() {
    return [
      '--frame-color-from',
      '--frame-color-to',
      '--frame-cut',
      '--frame-rounded',
      '--bg-color-from',
      '--bg-color-to',
      '--bg-gradient-offset-from',
      '--bg-gradient-offset-to',
      '--bg-gradient-center-x',
      '--bg-gradient-center-y',
      '--bg-gradient-ellipse-x',
      '--bg-gradient-ellipse-y',
      '--bg-gradient-ellipse-auto',
      '--border-width',
      '--card-bg-offset-top',
      '--card-bg-offset-right',
      '--card-bg-offset-bottom',
      '--card-bg-offset-left',
      '--corner-shape',
      '--corner-position',
      '--corner-roundness',
      '--corner-shape-size',
    ];
  }

  paint(ctx, size, props) {
    const getNumber = getNumberFactory(props);

    const offsetTop = getNumber('--card-bg-offset-top', 1);
    const offsetRight = getNumber('--card-bg-offset-right', 1);
    const offsetBottom = getNumber('--card-bg-offset-bottom', 1);
    const offsetLeft = getNumber('--card-bg-offset-left', 1);

    /*
      corner shape options:
      - none: 0
      - cut: 1
    */
    const cornerShape = getNumber('--corner-shape', 0);

    /*
      corner shape size options:
      - S, M, L, XL, XXL depending on the type
    */
    const cornerShapeSize = props.get('--corner-shape-size').length
      ? props.get('--corner-shape-size')
      : 'M';

    /*
      corner positions:
      - 0: top-left
      - 1: top-right
      - 2: bottom-right
      - 3: bottom-left
      - 4: all
    */
    const cornerPosition = getNumber('--corner-position', 4);
    const roundnessFactor = getNumber('--corner-roundness', 0);

    const pathData = UnderwaveClipPath(
      size.width - offsetLeft - offsetRight,
      size.height - offsetTop - offsetBottom,
      ...resolveCorners(cornerShape, cornerPosition, cornerShapeSize),
      roundnessFactor,
    );

    const p = new Path2D(pathData);
    ctx.translate(offsetLeft, offsetTop);

    const bgPositionFrom = getNumber('--bg-gradient-offset-from') || 0;
    const bgPositionTo = getNumber('--bg-gradient-offset-to') || 1;

    const containerWidth = size.width - offsetLeft - offsetRight;
    const containerHeight = size.height - offsetTop - offsetBottom;
    const aspectRatio = containerWidth / containerHeight;

    // scale based on aspect ratio, or use manual values
    const autoEllipse = getNumber('--bg-gradient-ellipse-auto', 1);
    let ellipseScaleX, ellipseScaleY;

    if (autoEllipse) {
      if (aspectRatio > 1) {
        ellipseScaleX = aspectRatio;
        ellipseScaleY = 1;
      } else {
        ellipseScaleX = 1;
        ellipseScaleY = 1 / aspectRatio;
      }

      // manual override/adjustment on top of auto
      const manualX = getNumber('--bg-gradient-ellipse-x', 0);
      const manualY = getNumber('--bg-gradient-ellipse-y', 0);
      if (manualX) {
        ellipseScaleX *= manualX;
      }
      if (manualY) {
        ellipseScaleY *= manualY;
      }
    } else {
      // manual
      ellipseScaleX = getNumber('--bg-gradient-ellipse-x') || 1;
      ellipseScaleY = getNumber('--bg-gradient-ellipse-y') || 1;
    }

    ctx.save();
    ctx.clip(p);

    ctx.scale(ellipseScaleX, ellipseScaleY);

    // center position (0-1 as ratio of container size, default 0.5 = center)
    const centerX = getNumber('--bg-gradient-center-x', 0.5);
    const centerY = getNumber('--bg-gradient-center-y', 0.5);

    const gradientCenterX = (containerWidth * centerX) / ellipseScaleX;
    const gradientCenterY = (containerHeight * centerY) / ellipseScaleY;

    const gradientInnerRadius = Math.max(
      0,
      (containerHeight * bgPositionFrom) / ellipseScaleY,
    );
    const gradientOuterRadius = Math.max(
      0,
      (containerHeight * bgPositionTo) / ellipseScaleY,
    );

    const bgGradient = ctx.createRadialGradient(
      gradientCenterX,
      gradientCenterY,
      gradientInnerRadius,
      gradientCenterX,
      gradientCenterY,
      gradientOuterRadius,
    );
    bgGradient.addColorStop(0, props.get('--bg-color-from'));
    bgGradient.addColorStop(0.32, props.get('--bg-color-from'));
    bgGradient.addColorStop(1, props.get('--bg-color-to'));

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, size.width / ellipseScaleX, size.height / ellipseScaleY);

    ctx.restore();

    if (getNumber('--border-width')) {
      const gradient = ctx.createLinearGradient(0, 0, 0, size.height);
      gradient.addColorStop(0, props.get('--frame-color-from'));
      gradient.addColorStop(0.32, props.get('--frame-color-from'));
      gradient.addColorStop(1, props.get('--frame-color-to'));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = getNumber('--border-width');
      ctx.stroke(p);
    }
  }
}

registerPaint('gx-card-background', CardBackground);
