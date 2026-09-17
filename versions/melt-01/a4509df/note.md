# melt-01 @ a4509df

surface/melt-01 v02 r3: root cause of the cold-decode starvation found and fixed — the inherited in-point guard reassigned currentTime every frame for 30s (~60 seeks/s, decoder restart loop; element fully buffered at 90s yet readyState 1 at 27s on c58df79); guard now re-asserts only on real drift beyond 1.5s, same condition as seekTick
