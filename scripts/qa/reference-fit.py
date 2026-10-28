"""Compare independently captured rendered panel edges with orange edges in source PNGs.
References remain in .research; no original animation images are shipped in the app.
"""
from PIL import Image, ImageDraw
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[2]
measurements=json.loads((root/'.research/rendered-landmarks.json').read_text())
report={'displayAspect':'4:3','sourceStoragePixels':'704x480','method':'Distance from sampled rendered polygon edges to independently extracted orange edges in reference PNG. Source and UI are shown at TV 4:3 display aspect. This measures panel geometry, not font/color/motion identity.','scenes':{}}
rows=[]
for scene,filename in [('diagnostics','71 - SysmwHd.png')]:
    source=Image.open(root/'.research/reference-frames'/filename).convert('RGB')
    ui=Image.open(root/f'docs/evidence/reference-{scene}.png').convert('RGB').resize((640,480))
    pixels=source.load()
    def orange(x,y):
        r,g,b=pixels[x,y]
        return r>45 and 12<g<r*.92 and b<g*.85
    distances=[]; panels={}
    annotated=source.copy(); draw=ImageDraw.Draw(annotated)
    for name,points in measurements[scene].items():
        values=[]
        for start,end in zip(points,points[1:]+points[:1]):
            length=math.dist(start,end)
            for j in range(1,int(length/6)):
                t=j/max(1,int(length/6)); x=start[0]+(end[0]-start[0])*t; y=start[1]+(end[1]-start[1])*t
                if not (8<x<696 and 8<y<472): continue
                near=[]
                for yy in range(max(0,round(y)-16),min(480,round(y)+17)):
                    for xx in range(max(0,round(x)-16),min(704,round(x)+17)):
                        if orange(xx,yy): near.append(math.hypot(xx-x,yy-y))
                d=min(near) if near else 24
                values.append(d); distances.append(d)
        draw.line([tuple(p) for p in points+[points[0]]],fill=(20,240,255),width=1)
        panels[name]={'meanSourcePixelError':round(sum(values)/len(values),2),'p95SourcePixelError':round(sorted(values)[int(len(values)*.95)],2)}
    mean=sum(distances)/len(distances); p95=sorted(distances)[int(len(distances)*.95)]
    report['scenes'][scene]={'source':filename,'samples':len(distances),'meanSourcePixelError':round(mean,2),'p95SourcePixelError':round(p95,2),'panels':panels}
    row=Image.new('RGB',(1920,510),'#141414'); d=ImageDraw.Draw(row)
    for i,(pic,label) in enumerate([(source,'Reference (display corrected)'),(ui,'Rendered SVG'),(annotated,'Reference + measured SVG outline (cyan)')]):
        row.paste(pic.resize((640,480)),(i*640,30)); d.text((i*640+12,10),f'{scene}: {label}',fill='white')
    rows.append(row)
    report['scenes'][scene]['passes']=mean<=4 and p95<=10
front=measurements['deliberation']
left=front['casper']; right=front['melchior']; top=front['balthasar']
mirrored=all(any(abs(a-(704-x))<.001 and abs(b-y)<.001 for a,b in right) for x,y in left)
level=abs(top[0][1]-top[1][1])<.001 and abs(top[3][1]-top[4][1])<.001
inside=all(38<=x<=666 and 38<=y<=449 for points in front.values() for x,y in points)
report['scenes']['deliberation']={'method':'Front-facing reconstruction: level edges, mirrored lower panels, complete geometry inside frame. No direct pixel score against an oblique camera capture.','horizontalTopAndBottom':level,'mirroredLowerPanels':mirrored,'insideFrame':inside,'passes':level and mirrored and inside}
canvas=Image.new('RGB',(1920,510));canvas.paste(rows[0],(0,0))
canvas.save(root/'.research/reference-comparison.png')
(root/'docs/evidence/reference-fit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if not all(scene['passes'] for scene in report['scenes'].values()): raise SystemExit(1)
